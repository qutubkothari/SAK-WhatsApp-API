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

interface SessionInfo {
  socket: WASocket;
  status: 'pending' | 'connected' | 'disconnected';
  qrCode?: string;
  phoneNumber?: string;
}

class WhatsAppGatewayService {
  private sessions: Map<string, SessionInfo> = new Map();
  private authBaseFolder = path.join(process.cwd(), 'whatsapp_sessions');
  private messageQueue: any[] = [];
  private processingQueue = false;

  async initialize() {
    if (!fs.existsSync(this.authBaseFolder)) {
      fs.mkdirSync(this.authBaseFolder, { recursive: true });
    }

    // Load existing sessions from database
    const activeSessions = await db('sessions')
      .where({ is_active: true, status: 'connected' });

    for (const session of activeSessions) {
      await this.connectSession(session.session_id, session.id);
    }

    // Start queue processor
    this.startQueueProcessor();

    logger.info('WhatsApp Gateway initialized');
  }

  async connectSession(sessionId: string, dbSessionId: string) {
    try {
      const sessionFolder = path.join(this.authBaseFolder, sessionId);

      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
      });

      this.sessions.set(sessionId, {
        socket: sock,
        status: 'pending'
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.sessions.get(sessionId)!.qrCode = qr;
          await db('sessions')
            .where({ id: dbSessionId })
            .update({ qr_code: qr, updated_at: db.fn.now() });
          
          logger.info(`QR Code generated for session: ${sessionId}`);
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          await db('sessions')
            .where({ id: dbSessionId })
            .update({ status: 'disconnected', updated_at: db.fn.now() });

          this.sessions.delete(sessionId);

          if (shouldReconnect) {
            setTimeout(() => this.connectSession(sessionId, dbSessionId), 5000);
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

    } catch (error) {
      logger.error(`Error connecting session ${sessionId}:`, error);
    }
  }

  async handleIncomingMessage(sessionId: string, dbSessionId: string, messages: WAMessage[]) {
    const webhooks = await db('webhooks')
      .where({ session_id: dbSessionId, is_active: true });

    for (const message of messages) {
      if (message.key.fromMe) continue;

      const messageData = {
        event: 'message.received',
        sessionId,
        from: message.key.remoteJid,
        messageId: message.key.id,
        timestamp: message.messageTimestamp,
        type: Object.keys(message.message || {})[0],
        text: message.message?.conversation || 
              message.message?.extendedTextMessage?.text || ''
      };

      for (const webhook of webhooks) {
        if (webhook.events.includes('message.received')) {
          await this.callWebhook(webhook.url, webhook.secret, messageData);
        }
      }
    }
  }

  async callWebhook(url: string, secret: string, data: any) {
    try {
      await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret
        },
        timeout: 5000
      });
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
      const sentMsg = await sessionInfo.socket.sendMessage(jid, { text });
      
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
      const sentMsg = await sessionInfo.socket.sendMessage(jid, {
        image: imageBuffer,
        caption: caption || ''
      });

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

  async sendDocument(sessionId: string, to: string, docBuffer: Buffer, filename: string, caption?: string): Promise<any> {
    const sessionInfo = this.sessions.get(sessionId);

    if (!sessionInfo || sessionInfo.status !== 'connected') {
      const messageId = uuidv4();
      this.messageQueue.push({
        id: messageId,
        sessionId,
        to,
        type: 'document',
        content: { docBuffer, filename, caption },
        retries: 0
      });
      return { success: false, messageId, status: 'queued' };
    }

    try {
      const jid = this.formatPhoneNumber(to);
      const sentMsg = await sessionInfo.socket.sendMessage(jid, {
        document: docBuffer,
        fileName: filename,
        caption: caption || '',
        mimetype: 'application/pdf'
      });

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

    const sessionFolder = path.join(this.authBaseFolder, sessionId);
    if (fs.existsSync(sessionFolder)) {
      fs.rmSync(sessionFolder, { recursive: true });
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
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
          await this.sendDocument(msg.sessionId, msg.to, msg.content.docBuffer, msg.content.filename, msg.content.caption);
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
        }
      } catch (error) {
        logger.error('Queue processing error:', error);
      }
    }
  }
}

export default new WhatsAppGatewayService();
