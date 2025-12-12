import { Router, Response } from 'express';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { validateApiKey } from '../middleware/auth';
import { apiKeyLimiter } from '../middleware/rateLimiter';
import WhatsAppGateway from '../services/whatsapp-gateway.service';
import logger from '../utils/logger';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Send text message
router.post('/send', apiKeyLimiter, validateApiKey, async (req: any, res: Response): Promise<void> => {
  try {
    const { to, text } = req.body;
    const session = req.session;

    if (!to || !text) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'to and text are required'
        }
      });
      return;
    }

    const result = await WhatsAppGateway.sendMessage(session.session_id, to, text);

    const messageId = uuidv4();
    await db('messages').insert({
      id: messageId,
      session_id: session.id,
      message_id: result.messageId || messageId,
      to_number: to,
      message_type: 'text',
      content: { text },
      status: result.status,
      created_at: db.fn.now()
    });

    // Update usage stats
    const today = new Date().toISOString().split('T')[0];
    const stat = await db('usage_stats')
      .where({ user_id: session.user_id, session_id: session.id, date: today })
      .first();

    if (stat) {
      await db('usage_stats')
        .where({ id: stat.id })
        .increment(result.status === 'sent' ? 'messages_sent' : 'messages_failed', 1);
    } else {
      await db('usage_stats').insert({
        id: uuidv4(),
        user_id: session.user_id,
        session_id: session.id,
        date: today,
        messages_sent: result.status === 'sent' ? 1 : 0,
        messages_failed: result.status === 'failed' ? 1 : 0,
        api_calls: 1,
        created_at: db.fn.now()
      });
    }

    logger.info(`Message sent via API: ${session.session_id} to ${to}`);

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status
      }
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_MESSAGE_FAILED',
        message: 'Failed to send message'
      }
    });
    return;
  }
});

// Send image
router.post('/send-image', apiKeyLimiter, validateApiKey, upload.single('image'), async (req: any, res: Response): Promise<void> => {
  try {
    const { to, caption } = req.body;
    const session = req.session;

    if (!to || !req.file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'to and image file are required'
        }
      });
      return;
    }

    const result = await WhatsAppGateway.sendImage(session.session_id, to, req.file.buffer, caption);

    const messageId = uuidv4();
    await db('messages').insert({
      id: messageId,
      session_id: session.id,
      message_id: result.messageId || messageId,
      to_number: to,
      message_type: 'image',
      content: { caption },
      status: result.status,
      created_at: db.fn.now()
    });

    logger.info(`Image sent via API: ${session.session_id} to ${to}`);

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status
      }
    });
  } catch (error) {
    logger.error('Send image error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_IMAGE_FAILED',
        message: 'Failed to send image'
      }
    });
    return;
  }
});

// Send document
router.post('/send-document', apiKeyLimiter, validateApiKey, upload.single('document'), async (req: any, res: Response): Promise<void> => {
  try {
    const { to, caption } = req.body;
    const session = req.session;

    if (!to || !req.file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'to and document file are required'
        }
      });
      return;
    }

    const result = await WhatsAppGateway.sendDocument(
      session.session_id,
      to,
      req.file.buffer,
      req.file.originalname,
      caption
    );

    const messageId = uuidv4();
    await db('messages').insert({
      id: messageId,
      session_id: session.id,
      message_id: result.messageId || messageId,
      to_number: to,
      message_type: 'document',
      content: { filename: req.file.originalname, caption },
      status: result.status,
      created_at: db.fn.now()
    });

    logger.info(`Document sent via API: ${session.session_id} to ${to}`);

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status
      }
    });
  } catch (error) {
    logger.error('Send document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_DOCUMENT_FAILED',
        message: 'Failed to send document'
      }
    });
    return;
  }
});

// Get message history
router.get('/history', validateApiKey, async (req: any, res: Response): Promise<void> => {
  try {
    const session = req.session;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await db('messages')
      .where({ session_id: session.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('message_id', 'to_number', 'message_type', 'status', 'created_at');

    res.json({
      success: true,
      data: { messages }
    });
  } catch (error) {
    logger.error('Get message history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_HISTORY_FAILED',
        message: 'Failed to fetch message history'
      }
    });
    return;
  }
});

export default router;
