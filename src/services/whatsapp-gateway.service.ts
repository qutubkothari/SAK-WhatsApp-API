import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from '../utils/logger';
import db from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import crypto from 'crypto';
import { DatabaseAuthState } from './database-auth-state';

interface SessionInfo {
  socket: WASocket;
  status: 'pending' | 'connected' | 'disconnected';
  qrCode?: string;
  phoneNumber?: string;
  keepAliveInterval?: NodeJS.Timeout;
  lastActivity?: number;
}

class WhatsAppGatewayService {
  private sessions: Map<string, SessionInfo> = new Map();
  private connectInFlight: Map<string, Promise<void>> = new Map();
  private authBaseFolder = path.join(process.cwd(), 'whatsapp_sessions');
  private messageQueue: any[] = [];
  private processingQueue = false;
  // LID to phone JID mapping: "@lid" -> "phone@s.whatsapp.net"
  private lidToPhoneMap: Map<string, string> = new Map();
  // Track recent sent messages for conversation-based @lid mapping
  private recentSentMessages: Map<string, { timestamp: number; sessionId: string }> = new Map();
  // Keep-alive monitor
  private keepAliveMonitor?: NodeJS.Timeout;

  private cleanupOldSentMessages(): void {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [phoneJid, data] of this.recentSentMessages.entries()) {
      if (now - data.timestamp > ONE_DAY) {
        this.recentSentMessages.delete(phoneJid);
      }
    }
    // Keep max 200 entries
    if (this.recentSentMessages.size > 200) {
      const sorted = Array.from(this.recentSentMessages.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = sorted.slice(0, this.recentSentMessages.size - 200);
      toDelete.forEach(([key]) => this.recentSentMessages.delete(key));
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label}_TIMEOUT`));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async initialize() {
    logger.info('WhatsApp Gateway initializing...');
    if (!fs.existsSync(this.authBaseFolder)) {
      fs.mkdirSync(this.authBaseFolder, { recursive: true });
    }

    // Load existing active sessions from database (reconnect on restart)
    const activeSessions = await db('sessions')
      .where({ is_active: true })
      .select('session_id', 'id');

    logger.info(`WhatsApp Gateway found ${activeSessions.length} active session(s) in DB`);

    for (const session of activeSessions) {
      // Avoid double-connecting if initialize is called twice
      if (!this.sessions.has(session.session_id)) {
        logger.info(`WhatsApp Gateway reconnecting session ${session.session_id}`);
        await this.connectSession(session.session_id, session.id);
      }
    }

    // Start queue processor
    this.startQueueProcessor();

    // Start keep-alive monitor
    this.startKeepAliveMonitor();

    logger.info('WhatsApp Gateway initialized');
  }

  hasSession(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  isConnecting(sessionId: string) {
    return this.connectInFlight.has(sessionId);
  }

  async connectSession(sessionId: string, dbSessionId: string) {
    const inFlight = this.connectInFlight.get(sessionId);
    if (inFlight) {
      logger.info(`Gateway connectSession skipped (already connecting): sessionId=${sessionId}`);
      return inFlight;
    }

    const existing = this.sessions.get(sessionId);
    if (existing && (existing.status === 'pending' || existing.status === 'connected')) {
      logger.info(`Gateway connectSession skipped (already ${existing.status}): sessionId=${sessionId}`);
      return;
    }

    const connectPromise = this.connectSessionInternal(sessionId, dbSessionId)
      .catch(async (error) => {
        logger.error(`Error connecting session ${sessionId}:`, error);
        
        // If session has no/invalid auth, deactivate it to prevent crash loops
        if (error?.message?.includes("Cannot read properties of undefined (reading 'me')")) {
          logger.warn(`Deactivating session ${sessionId} due to missing/invalid auth`);
          await db('sessions')
            .where({ id: dbSessionId })
            .update({ is_active: false, status: 'disconnected', updated_at: db.fn.now() });
        }
      })
      .finally(() => {
        this.connectInFlight.delete(sessionId);
      });

    this.connectInFlight.set(sessionId, connectPromise);
    return connectPromise;
  }

  private async connectSessionInternal(sessionId: string, dbSessionId: string) {
    logger.info(`Gateway connectSession start: sessionId=${sessionId} dbSessionId=${dbSessionId}`);

    await db('sessions')
      .where({ id: dbSessionId })
      .update({ status: 'pending', updated_at: db.fn.now() });

    // Use database-backed auth state instead of file system
    const dbAuth = new DatabaseAuthState(dbSessionId);
    let { state, saveCreds } = await dbAuth.getAuthState();

    // CRITICAL: Baileys crashes if state.creds is truthy but missing 'me' field
    // Safe scenarios: creds is null/undefined (generates QR) OR has valid 'me' field
    // Crash scenario: creds is {} or has data but no 'me' field
    logger.info(`Session ${sessionId} auth check: creds=${state.creds ? JSON.stringify(Object.keys(state.creds)).substring(0, 100) : 'null/undefined'}`);
    
    if (state.creds && !state.creds.me) {
      logger.warn(`Session ${sessionId} has invalid creds (exists but no 'me'), clearing for fresh QR generation`);
      await dbAuth.clearAuthState();
      // Get fresh empty state to generate new QR
      const freshAuth = await dbAuth.getAuthState();
      state = freshAuth.state;
      saveCreds = freshAuth.saveCreds;
      logger.info(`Session ${sessionId} cleared, now creds=${state.creds ? 'exists' : 'null/undefined'}`);
    }

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' })
    });

    this.sessions.set(sessionId, {
      socket: sock,
      status: 'pending'
    });

    logger.info(`Gateway socket created: sessionId=${sessionId} (pending)`);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection) {
        logger.info(`Gateway connection.update: sessionId=${sessionId} connection=${connection}`);
      }

      if (qr) {
        const current = this.sessions.get(sessionId);
        if (current) current.qrCode = qr;
        await db('sessions')
          .where({ id: dbSessionId })
          .update({ qr_code: qr, updated_at: db.fn.now() });

        logger.info(`QR Code generated for session: ${sessionId}`);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errAny: any = lastDisconnect?.error as any;
        const errMsg =
          errAny?.output?.payload?.message ||
          errAny?.message ||
          (typeof errAny === 'string' ? errAny : undefined) ||
          undefined;

        logger.warn(
          `Gateway connection closed: sessionId=${sessionId} statusCode=${statusCode} shouldReconnect=${shouldReconnect}` +
            (errMsg ? ` message=${String(errMsg)}` : '')
        );

        await db('sessions')
          .where({ id: dbSessionId })
          .update({ status: 'disconnected', updated_at: db.fn.now() });

        // Clear in-memory state for this session (if this socket is still the current one)
        const current = this.sessions.get(sessionId);
        if (current?.socket === sock) {
          // Clear keep-alive interval
          if (current.keepAliveInterval) {
            clearInterval(current.keepAliveInterval);
          }
          this.sessions.delete(sessionId);
        }

        if (shouldReconnect) {
          logger.info(`Gateway reconnect scheduled: sessionId=${sessionId} in 5s`);
          setTimeout(() => void this.connectSession(sessionId, dbSessionId), 5000);
        } else {
          logger.warn(`Gateway will not reconnect (logged out): sessionId=${sessionId}`);
        }
      } else if (connection === 'open') {
        const phoneNumber = sock.user?.id?.split(':')[0];

        await db('sessions')
          .where({ id: dbSessionId })
          .update({
            status: 'connected',
            phone_number: phoneNumber,
            last_connected_at: db.fn.now(),
            qr_code: null,
            updated_at: db.fn.now()
          });

        this.sessions.set(sessionId, {
          socket: sock,
          status: 'connected',
          phoneNumber
        });

        logger.info(`Session connected: ${sessionId} (${phoneNumber})`);

        // Process queued messages
        await this.processQueueForSession(sessionId);

        // Setup keep-alive for this session
        this.setupSessionKeepAlive(sessionId);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      await this.handleIncomingMessage(sessionId, dbSessionId, messages);
    });

    sock.ev.on('creds.update', saveCreds);

    logger.info(`Gateway connectSession listeners attached: sessionId=${sessionId}`);
  }

  async handleIncomingMessage(sessionId: string, dbSessionId: string, messages: WAMessage[]) {
    // Update last activity timestamp
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      sessionInfo.lastActivity = Date.now();
    }

    const webhooks = await db('webhooks')
      .where({ session_id: dbSessionId, is_active: true });

    const eventEnabled = (rawEvents: unknown, wanted: string): boolean => {
      if (Array.isArray(rawEvents)) {
        return rawEvents.includes(wanted) || rawEvents.includes('message');
      }

      if (typeof rawEvents === 'string') {
        // Handle a few possible shapes:
        // - 'message.received'
        // - 'message'
        // - '{message.received,session.status}' (pg array text representation)
        const trimmed = rawEvents.trim();
        if (!trimmed) return false;
        if (trimmed === wanted || trimmed === 'message') return true;

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const items = trimmed
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          return items.includes(wanted) || items.includes('message');
        }

        return trimmed.includes(wanted);
      }

      return false;
    };

    for (const message of messages) {
      if (message.key.fromMe) continue;

      const type = Object.keys(message.message || {})[0];
      const remoteJid = message.key.remoteJid || '';
      
      // Extract phone-based identifiers (wa_id / from_number) from the remoteJid
      // Examples:
      //   "918484862949@s.whatsapp.net" -> wa_id: "918484862949"
      //   "116947849052172@lid" -> wa_id: "116947849052172" (keep @lid but add mapping)
      let waId = '';
      let fromNumber = '';
      let fromJid = remoteJid;
      let fromLid = '';

      if (remoteJid.includes('@s.whatsapp.net')) {
        // Phone-based JID
        waId = remoteJid.split('@')[0];
        fromNumber = waId.startsWith('+') ? waId : `+${waId}`;
        fromJid = remoteJid;
      } else if (remoteJid.includes('@lid')) {
        // LID-based JID - try to extract phone from pushName or participant metadata
        fromLid = remoteJid;
        waId = remoteJid.split('@')[0];
        
        // Check if Baileys provides participant info with phone number
        const participant = message.key.participant;
        if (participant && participant.includes('@s.whatsapp.net')) {
          waId = participant.split('@')[0];
          fromNumber = waId.startsWith('+') ? waId : `+${waId}`;
          fromJid = participant;
          
          // Store LID→phone mapping for auto-resolution when replying
          this.lidToPhoneMap.set(remoteJid, participant);
          logger.info(`Stored LID mapping: ${remoteJid} → ${participant}`);
        } else {
          // Cannot resolve @lid to phone without participant data
          // Do NOT infer from recent conversations as this causes routing bugs
          logger.warn(`@lid message without phone resolution: ${remoteJid}. No participant data available.`);
          fromNumber = waId; // Use LID number as fallback
          fromJid = remoteJid;
        }
      }

      logger.info(
        `Inbound message: sessionId=${sessionId} from=${fromJid} wa_id=${waId} messageId=${message.key.id} type=${type}`
      );

      // Only process webhook and auto-reply if we have a phone-based JID (never @lid)
      if (!fromJid.includes('@s.whatsapp.net')) {
        logger.warn(`Skipping webhook and auto-reply for non-phone JID: ${fromJid}`);
        continue;
      }

      const messageData: any = {
        event: 'message.received',
        sessionId,
        from: fromJid, // ALWAYS phone-based JID (never @lid)
        from_jid: fromJid,
        messageId: message.key.id,
        timestamp: message.messageTimestamp,
        type,
        text: message.message?.conversation || 
              message.message?.extendedTextMessage?.text || ''
      };

      // Add phone identifiers if we have them
      if (waId) {
        messageData.wa_id = waId;
      }
      if (fromNumber) {
        messageData.from_number = fromNumber;
      }
      if (fromLid) {
        messageData.from_lid = fromLid; // Keep @lid for reference
      }

      // Add pushName if available
      if (message.pushName) {
        messageData.pushName = message.pushName;
      }

      for (const webhook of webhooks) {
        if (eventEnabled(webhook.events, 'message.received')) {
          await this.callWebhook(webhook.url, webhook.secret, messageData);
        }
      }

      // Check for auto-reply
      await this.handleAutoReply(sessionId, dbSessionId, fromJid, messageData.text);
    }
  }

  async callWebhook(url: string, secret: string, data: any) {
    try {
      const payload = JSON.stringify(data);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const resp = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret,
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': data?.event || 'message.received'
        },
        timeout: 8000,
        validateStatus: () => true
      });

      const ok = resp.status >= 200 && resp.status < 300;
      if (ok) {
        logger.info(`Webhook delivered: url=${url} status=${resp.status} event=${data?.event || 'message.received'}`);
      } else {
        const preview =
          typeof resp.data === 'string'
            ? resp.data.slice(0, 300)
            : JSON.stringify(resp.data).slice(0, 300);
        logger.warn(
          `Webhook rejected: url=${url} status=${resp.status} event=${data?.event || 'message.received'} body=${preview}`
        );
      }
    } catch (error) {
      logger.error('Webhook call failed:', error);
    }
  }

  async sendMessage(sessionId: string, to: string, text: string): Promise<any> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo || sessionInfo.status !== 'connected') {
      // Queue message
      const messageId = uuidv4();
      this.messageQueue.push({
        id: messageId,
        sessionId,
        to,
        type: 'text',
        content: { text },
        retries: 0
      });
      return { success: false, messageId, status: 'queued' };
    }

    try {
      // Auto-resolve @lid to phone-based JID if available
      let targetJid = to;
      if (to.includes('@lid')) {
        if (this.lidToPhoneMap.has(to)) {
          targetJid = this.lidToPhoneMap.get(to)!;
          logger.info(`Resolved @lid: ${to} → ${targetJid}`);
        } else {
          // Reject @lid that we cannot resolve (would look like spam)
          logger.error(`Cannot send to unresolved @lid: ${to}`);
          return {
            success: false,
            error: 'Cannot send to @lid address - phone number not available. Customer must message you first.',
            status: 'failed'
          };
        }
      } else {
        targetJid = this.formatPhoneNumber(to);
      }
      
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(targetJid, { text }),
        25000,
        'SEND_MESSAGE'
      );
      
      // Update last activity
      sessionInfo.lastActivity = Date.now();
      
      // Track sent message for conversation-based @lid mapping
      const phoneJid = targetJid.includes('@s.whatsapp.net') ? targetJid : this.formatPhoneNumber(to);
      this.recentSentMessages.set(phoneJid, { timestamp: Date.now(), sessionId });
      this.cleanupOldSentMessages();
      
      return {
        success: true,
        messageId: sentMsg?.key?.id,
        status: 'sent'
      };
    } catch (error: any) {
      logger.error('Send message error:', error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  async sendImage(sessionId: string, to: string, imageBuffer: Buffer, caption?: string): Promise<any> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo || sessionInfo.status !== 'connected') {
      const messageId = uuidv4();
      this.messageQueue.push({
        id: messageId,
        sessionId,
        to,
        type: 'image',
        content: { imageBuffer, caption },
        retries: 0
      });
      return { success: false, messageId, status: 'queued' };
    }

    try {
      // Auto-resolve @lid to phone-based JID if available
      let targetJid = to;
      if (to.includes('@lid') && this.lidToPhoneMap.has(to)) {
        targetJid = this.lidToPhoneMap.get(to)!;
        logger.info(`Resolved @lid: ${to} → ${targetJid}`);
      } else {
        targetJid = this.formatPhoneNumber(to);
      }
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(targetJid, {
          image: imageBuffer,
          caption: caption || ''
        }),
        25000,
        'SEND_IMAGE'
      );

      // Track sent message for conversation-based @lid mapping
      const phoneJid = targetJid.includes('@s.whatsapp.net') ? targetJid : this.formatPhoneNumber(to);
      this.recentSentMessages.set(phoneJid, { timestamp: Date.now(), sessionId });
      this.cleanupOldSentMessages();

      return {
        success: true,
        messageId: sentMsg?.key?.id,
        status: 'sent'
      };
    } catch (error: any) {
      logger.error(`Send image error (session: ${sessionId}, to: ${to}):`, error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  async sendDocument(
    sessionId: string,
    to: string,
    docBuffer: Buffer,
    filename: string,
    caption?: string,
    mimetype?: string
  ): Promise<any> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo || sessionInfo.status !== 'connected') {
      const messageId = uuidv4();
      this.messageQueue.push({
        id: messageId,
        sessionId,
        to,
        type: 'document',
        content: { docBuffer, filename, caption, mimetype },
        retries: 0
      });
      return { success: false, messageId, status: 'queued' };
    }

    try {
      // Auto-resolve @lid to phone-based JID if available
      let targetJid = to;
      if (to.includes('@lid')) {
        if (this.lidToPhoneMap.has(to)) {
          targetJid = this.lidToPhoneMap.get(to)!;
          logger.info(`Resolved @lid: ${to} → ${targetJid}`);
        } else {
          return {
            success: false,
            error: 'Cannot send to @lid address - phone number not available. Customer must message you first.',
            status: 'failed'
          };
        }
      } else {
        targetJid = this.formatPhoneNumber(to);
      }
      
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(targetJid, {
          document: docBuffer,
          fileName: filename,
          caption: caption || '',
          mimetype: mimetype || 'application/octet-stream'
        }),
        25000,
        'SEND_DOCUMENT'
      );

      // Track sent message for conversation-based @lid mapping
      const phoneJid = targetJid.includes('@s.whatsapp.net') ? targetJid : this.formatPhoneNumber(to);
      this.recentSentMessages.set(phoneJid, { timestamp: Date.now(), sessionId });
      this.cleanupOldSentMessages();

      return {
        success: true,
        messageId: sentMsg?.key?.id,
        status: 'sent'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  async sendVideo(
    sessionId: string,
    to: string,
    videoBuffer: Buffer,
    caption?: string,
    mimetype?: string,
    filename?: string
  ): Promise<any> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo || sessionInfo.status !== 'connected') {
      const messageId = uuidv4();
      this.messageQueue.push({
        id: messageId,
        sessionId,
        to,
        type: 'video',
        content: { videoBuffer, caption, mimetype, filename },
        retries: 0
      });
      return { success: false, messageId, status: 'queued' };
    }

    try {
      // Auto-resolve @lid to phone-based JID if available
      let targetJid = to;
      if (to.includes('@lid')) {
        if (this.lidToPhoneMap.has(to)) {
          targetJid = this.lidToPhoneMap.get(to)!;
          logger.info(`Resolved @lid: ${to} → ${targetJid}`);
        } else {
          return {
            success: false,
            error: 'Cannot send to @lid address - phone number not available. Customer must message you first.',
            status: 'failed'
          };
        }
      } else {
        targetJid = this.formatPhoneNumber(to);
      }
      
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(targetJid, {
          video: videoBuffer,
          caption: caption || '',
          mimetype: mimetype || 'video/mp4'
        }),
        45000,
        'SEND_VIDEO'
      );

      // Track sent message for conversation-based @lid mapping
      const phoneJid = targetJid.includes('@s.whatsapp.net') ? targetJid : this.formatPhoneNumber(to);
      this.recentSentMessages.set(phoneJid, { timestamp: Date.now(), sessionId });
      this.cleanupOldSentMessages();

      return {
        success: true,
        messageId: sentMsg?.key?.id,
        status: 'sent'
      };
    } catch (error: any) {
      logger.error(`Send video error (session: ${sessionId}, to: ${to}):`, error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  getSessionStatus(sessionId: string) {
    const sessionInfo = this.sessions.get(sessionId);
    return {
      connected: sessionInfo?.status === 'connected',
      qrCode: sessionInfo?.qrCode,
      phoneNumber: sessionInfo?.phoneNumber
    };
  }

  async disconnectSession(sessionId: string) {
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      await sessionInfo.socket.logout();
      this.sessions.delete(sessionId);
    }

    // Clear DB-backed auth state
    const session = await db('sessions').where({ session_id: sessionId }).first();
    if (session) {
      const dbAuth = new DatabaseAuthState(session.id);
      await dbAuth.clearAuthState();
      logger.info(`Cleared DB auth state for session: ${sessionId}`);
    }

    // Also clean up any old file-based auth (migration cleanup)
    const sessionFolder = path.join(this.authBaseFolder, sessionId);
    if (fs.existsSync(sessionFolder)) {
      fs.rmSync(sessionFolder, { recursive: true });
      logger.info(`Removed legacy file auth folder: ${sessionId}`);
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    // E.164 max length is 15 digits; also reject empty/too-short inputs.
    if (cleaned.length < 8 || cleaned.length > 15) {
      throw new Error('INVALID_PHONE_NUMBER');
    }

    return cleaned + '@s.whatsapp.net';
  }

  private startQueueProcessor() {
    setInterval(async () => {
      if (!this.processingQueue && this.messageQueue.length > 0) {
        this.processingQueue = true;
        await this.processQueue();
        this.processingQueue = false;
      }
    }, 5000);
  }

  private async processQueue() {
    const toProcess = [...this.messageQueue];
    this.messageQueue = [];

    for (const msg of toProcess) {
      if (msg.retries >= 3) continue;

      const sessionInfo = this.sessions.get(msg.sessionId);
      if (!sessionInfo || sessionInfo.status !== 'connected') {
        msg.retries++;
        this.messageQueue.push(msg);
        continue;
      }

      try {
        if (msg.type === 'text') {
          await this.sendMessage(msg.sessionId, msg.to, msg.content.text);
        } else if (msg.type === 'image') {
          await this.sendImage(msg.sessionId, msg.to, msg.content.imageBuffer, msg.content.caption);
        } else if (msg.type === 'document') {
          await this.sendDocument(
            msg.sessionId,
            msg.to,
            msg.content.docBuffer,
            msg.content.filename,
            msg.content.caption,
            msg.content.mimetype
          );
        } else if (msg.type === 'video') {
          await this.sendVideo(
            msg.sessionId,
            msg.to,
            msg.content.videoBuffer,
            msg.content.caption,
            msg.content.mimetype,
            msg.content.filename
          );
        }
      } catch (error) {
        msg.retries++;
        this.messageQueue.push(msg);
      }
    }
  }

  private async processQueueForSession(sessionId: string) {
    const sessionMessages = this.messageQueue.filter(m => m.sessionId === sessionId);
    this.messageQueue = this.messageQueue.filter(m => m.sessionId !== sessionId);

    for (const msg of sessionMessages) {
      try {
        if (msg.type === 'text') {
          await this.sendMessage(msg.sessionId, msg.to, msg.content.text);
        } else if (msg.type === 'image') {
          await this.sendImage(msg.sessionId, msg.to, msg.content.imageBuffer, msg.content.caption);
        } else if (msg.type === 'document') {
          await this.sendDocument(
            msg.sessionId,
            msg.to,
            msg.content.docBuffer,
            msg.content.filename,
            msg.content.caption,
            msg.content.mimetype
          );
        } else if (msg.type === 'video') {
          await this.sendVideo(
            msg.sessionId,
            msg.to,
            msg.content.videoBuffer,
            msg.content.caption,
            msg.content.mimetype,
            msg.content.filename
          );
        }
      } catch (error) {
        msg.retries = (msg.retries || 0) + 1;
        if (msg.retries < 3) {
          this.messageQueue.push(msg);
        }
        logger.error('Queue processing error:', error);
      }
    }
  }

  private setupSessionKeepAlive(sessionId: string) {
    const sessionInfo = this.sessions.get(sessionId);
    if (!sessionInfo) return;

    // Clear any existing keep-alive
    if (sessionInfo.keepAliveInterval) {
      clearInterval(sessionInfo.keepAliveInterval);
    }

    // Initialize last activity
    sessionInfo.lastActivity = Date.now();

    // Ping every 30 seconds to keep connection alive
    sessionInfo.keepAliveInterval = setInterval(async () => {
      try {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'connected') {
          // Query WhatsApp servers to keep connection alive
          await session.socket.query({
            tag: 'iq',
            attrs: {
              id: uuidv4(),
              xmlns: 'w:p',
              type: 'get',
              to: '@s.whatsapp.net'
            }
          });
          logger.debug(`Keep-alive ping sent for session: ${sessionId}`);
        }
      } catch (error) {
        logger.warn(`Keep-alive ping failed for session ${sessionId}:`, error);
      }
    }, 30000); // 30 seconds

    logger.info(`Keep-alive setup for session: ${sessionId}`);
  }

  private startKeepAliveMonitor() {
    // Monitor all sessions every 2 minutes
    this.keepAliveMonitor = setInterval(async () => {
      const now = Date.now();
      const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

      for (const [sessionId, sessionInfo] of this.sessions.entries()) {
        if (sessionInfo.status === 'connected') {
          const timeSinceActivity = now - (sessionInfo.lastActivity || 0);
          
          if (timeSinceActivity > INACTIVE_THRESHOLD) {
            logger.warn(`Session ${sessionId} inactive for ${Math.floor(timeSinceActivity / 1000)}s, checking connection...`);
            
            try {
              // Try to fetch own profile to verify connection
              await sessionInfo.socket.query({
                tag: 'iq',
                attrs: {
                  id: uuidv4(),
                  xmlns: 'w:p',
                  type: 'get',
                  to: '@s.whatsapp.net'
                }
              });
              sessionInfo.lastActivity = now;
              logger.info(`Session ${sessionId} connection verified`);
            } catch (error) {
              logger.error(`Session ${sessionId} connection check failed, may need reconnection:`, error);
            }
          }
        }
      }
    }, 120000); // 2 minutes

    logger.info('Keep-alive monitor started');
  }

  private async handleAutoReply(sessionId: string, dbSessionId: string, fromJid: string, incomingText: string) {
    try {
      // Get session settings
      const session = await db('sessions')
        .where({ id: dbSessionId })
        .first();

      if (!session || !session.auto_reply_enabled) {
        return;
      }

      // Don't auto-reply to empty messages or media-only messages
      if (!incomingText || incomingText.trim().length === 0) {
        return;
      }

      const autoReplyMessage = session.auto_reply_message || 
        'Thank you for your message! We will get back to you soon.';

      logger.info(`Sending auto-reply to ${fromJid} for session ${sessionId}`);

      // Send auto-reply using existing sendMessage logic
      await this.sendMessage(sessionId, fromJid, autoReplyMessage);
    } catch (error) {
      logger.error(`Auto-reply error for session ${sessionId}:`, error);
    }
  }
}

export default new WhatsAppGatewayService();
