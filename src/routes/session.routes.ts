import { Router, Response } from 'express';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import WhatsAppGateway from '../services/whatsapp-gateway.service';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Create session
router.post('/', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Check plan limits
    const sessions = await db('sessions')
      .where({ user_id: userId, is_active: true })
      .count('* as count');

    const sessionCount = parseInt(sessions[0].count as string);
    const user = await db('users').where({ id: userId }).first();

    const limits: any = {
      free: 1,
      starter: 3,
      pro: 10,
      enterprise: 999
    };

    if (sessionCount >= limits[user.plan]) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SESSION_LIMIT_REACHED',
          message: `Plan limit: ${limits[user.plan]} sessions`
        }
      });
      return;
    }

    const sessionId = uuidv4();
    const apiKey = crypto.randomBytes(32).toString('hex');

    await db('sessions').insert({
      id: uuidv4(),
      user_id: userId,
      session_id: sessionId,
      name: name || `Session ${sessionCount + 1}`,
      api_key: apiKey,
      status: 'pending',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    const dbSession = await db('sessions')
      .where({ session_id: sessionId })
      .first();

    await WhatsAppGateway.connectSession(sessionId, dbSession.id);

    logger.info(`Session created: ${sessionId} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        apiKey,
        name: name || `Session ${sessionCount + 1}`,
        status: 'pending',
        message: 'Scan QR code to connect'
      }
    });
    return;
  } catch (error) {
    logger.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_CREATE_FAILED',
        message: 'Failed to create session'
      }
    });
    return;
  }
});

// Get all sessions
router.get('/', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const sessions = await db('sessions')
      .where({ user_id: req.user.id, is_active: true })
      .select('session_id', 'name', 'status', 'api_key', 'phone_number', 'last_connected_at', 'created_at', 'auto_reply_enabled', 'auto_reply_message')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s: any) => ({
          sessionId: s.session_id,
          name: s.name,
          status: s.status,
          apiKey: s.api_key,
          phoneNumber: s.phone_number,
          lastConnectedAt: s.last_connected_at,
          createdAt: s.created_at,
          autoReplyEnabled: s.auto_reply_enabled,
          autoReplyMessage: s.auto_reply_message
        }))
      }
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SESSIONS_FAILED',
        message: 'Failed to fetch sessions'
      }
    });
    return;
  }
});

// Get session status
router.get('/:sessionId/status', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await db('sessions')
      .where({ session_id: sessionId, user_id: req.user.id })
      .first();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
      return;
    }

    // If the gateway lost in-memory state (e.g. container restart), trigger reconnect.
    if (!WhatsAppGateway.hasSession(sessionId) && session.is_active) {
      logger.info(`Auto-reconnect (status): sessionId=${sessionId} dbSessionId=${session.id}`);
      await WhatsAppGateway.connectSession(sessionId, session.id);
    }

    const status = WhatsAppGateway.getSessionStatus(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        name: session.name,
        connected: status.connected,
        phoneNumber: status.phoneNumber || session.phone_number,
        lastConnectedAt: session.last_connected_at
      }
    });
  } catch (error) {
    logger.error('Get session status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: 'Failed to fetch session status'
      }
    });
    return;
  }
});

// Get session details
router.get('/:sessionId', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await db('sessions')
      .where({ session_id: sessionId, user_id: req.user.id, is_active: true })
      .first();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionId: session.session_id,
        name: session.name,
        status: session.status,
        apiKey: session.api_key,
        phoneNumber: session.phone_number,
        lastConnectedAt: session.last_connected_at,
        createdAt: session.created_at
      }
    });
  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SESSION_FAILED',
        message: 'Failed to fetch session'
      }
    });
    return;
  }
});

// Get QR code
router.get('/:sessionId/qr', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await db('sessions')
      .where({ session_id: sessionId, user_id: req.user.id })
      .first();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
      return;
    }

    // If the gateway lost in-memory state (e.g. container restart), trigger reconnect.
    if (!WhatsAppGateway.hasSession(sessionId) && session.is_active) {
      logger.info(`Auto-reconnect (qr): sessionId=${sessionId} dbSessionId=${session.id}`);
      await WhatsAppGateway.connectSession(sessionId, session.id);
    }

    const status = WhatsAppGateway.getSessionStatus(sessionId);

    // Avoid noisy 404s during initialization; return qrCode null until available.
    res.json({
      success: true,
      data: {
        qrCode: status.qrCode || null,
        connected: status.connected,
        message: status.qrCode
          ? 'Scan this QR code with WhatsApp'
          : (status.connected ? 'Session is connected' : 'QR not ready yet, retry shortly')
      }
    });
  } catch (error) {
    logger.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'QR_FETCH_FAILED',
        message: 'Failed to fetch QR code'
      }
    });
    return;
  }
});

// Delete session
router.delete('/:sessionId', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await db('sessions')
      .where({ session_id: sessionId, user_id: req.user.id })
      .first();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
      return;
    }

    await WhatsAppGateway.disconnectSession(sessionId);

    await db('sessions')
      .where({ id: session.id })
      .update({
        is_active: false,
        status: 'disconnected',
        updated_at: db.fn.now()
      });

    logger.info(`Session deleted: ${sessionId}`);

    res.json({
      success: true,
      message: 'Session disconnected and deleted'
    });
  } catch (error) {
    logger.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_DELETE_FAILED',
        message: 'Failed to delete session'
      }
    });
    return;
  }
});

// Update session auto-reply settings
router.put('/:sessionId/auto-reply', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { enabled, message } = req.body;

    const session = await db('sessions')
      .where({ session_id: sessionId, user_id: req.user.id })
      .first();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
      return;
    }

    const updateData: any = { updated_at: db.fn.now() };
    
    if (typeof enabled === 'boolean') {
      updateData.auto_reply_enabled = enabled;
    }
    
    if (message !== undefined) {
      updateData.auto_reply_message = message;
    }

    await db('sessions')
      .where({ id: session.id })
      .update(updateData);

    logger.info(`Auto-reply updated for session: ${sessionId}`);

    res.json({
      success: true,
      message: 'Auto-reply settings updated',
      data: {
        autoReplyEnabled: updateData.auto_reply_enabled ?? session.auto_reply_enabled,
        autoReplyMessage: updateData.auto_reply_message ?? session.auto_reply_message
      }
    });
  } catch (error) {
    logger.error('Update auto-reply error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTO_REPLY_UPDATE_FAILED',
        message: 'Failed to update auto-reply settings'
      }
    });
    return;
  }
});

export default router;


