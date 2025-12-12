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
      .where({ user_id: req.user.id })
      .select('session_id', 'name', 'status', 'phone_number', 'last_connected_at', 'created_at')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { sessions }
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

    const status = WhatsAppGateway.getSessionStatus(sessionId);

    if (!status.qrCode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_AVAILABLE',
          message: 'QR code not available. Session may be connected or disconnected.'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        qrCode: status.qrCode,
        message: 'Scan this QR code with WhatsApp'
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

export default router;


