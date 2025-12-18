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
}

class WhatsAppGatewayService {
  private sessions: Map<string, SessionInfo> = new Map();
  private connectInFlight: Map<string, Promise<void>> = new Map();
  private authBaseFolder = path.join(process.cwd(), 'whatsapp_sessions');
  private messageQueue: any[] = [];
  private processingQueue = false;

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
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      await this.handleIncomingMessage(sessionId, dbSessionId, messages);
    });

    sock.ev.on('creds.update', saveCreds);

    logger.info(`Gateway connectSession listeners attached: sessionId=${sessionId}`);
  }

  async handleIncomingMessage(sessionId: string, dbSessionId: string, messages: WAMessage[]) {
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
      logger.info(
        `Inbound message: sessionId=${sessionId} from=${message.key.remoteJid} messageId=${message.key.id} type=${type}`
      );

      const messageData = {
        event: 'message.received',
        sessionId,
        from: message.key.remoteJid,
        messageId: message.key.id,
        timestamp: message.messageTimestamp,
        type,
        text: message.message?.conversation || 
              message.message?.extendedTextMessage?.text || ''
      };

      for (const webhook of webhooks) {
        if (eventEnabled(webhook.events, 'message.received')) {
          await this.callWebhook(webhook.url, webhook.secret, messageData);
        }
      }
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
      const jid = this.formatPhoneNumber(to);
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(jid, { text }),
        25000,
        'SEND_MESSAGE'
      );
      
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
      const jid = this.formatPhoneNumber(to);
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(jid, {
          image: imageBuffer,
          caption: caption || ''
        }),
        25000,
        'SEND_IMAGE'
      );

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
      const jid = this.formatPhoneNumber(to);
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(jid, {
          document: docBuffer,
          fileName: filename,
          caption: caption || '',
          mimetype: mimetype || 'application/octet-stream'
        }),
        25000,
        'SEND_DOCUMENT'
      );

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
      const jid = this.formatPhoneNumber(to);
      const sentMsg = await this.withTimeout(
        sessionInfo.socket.sendMessage(jid, {
          video: videoBuffer,
          caption: caption || '',
          mimetype: mimetype || 'video/mp4'
        }),
        45000,
        'SEND_VIDEO'
      );

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
}

export default new WhatsAppGatewayService();
