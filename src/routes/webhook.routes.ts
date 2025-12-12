import { Router, Response } from 'express';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Create webhook
router.post('/', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId, url, events } = req.body;

    if (!sessionId || !url || !events || !Array.isArray(events)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sessionId, url, and events array are required'
        }
      });
      return;
    }

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

    const secret = crypto.randomBytes(32).toString('hex');

    const webhookId = uuidv4();
    await db('webhooks').insert({
      id: webhookId,
      session_id: session.id,
      url,
      secret,
      events,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    logger.info(`Webhook created for session ${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        webhookId,
        url,
        secret,
        events
      }
    });
    return;
  } catch (error) {
    logger.error('Create webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_CREATE_FAILED',
        message: 'Failed to create webhook'
      }
    });
    return;
  }
});

// Get webhooks
router.get('/', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.query;

    let query = db('webhooks')
      .join('sessions', 'webhooks.session_id', 'sessions.id')
      .where({ 'sessions.user_id': req.user.id });

    if (sessionId) {
      query = query.where({ 'sessions.session_id': sessionId });
    }

    const webhooks = await query.select(
      'webhooks.id',
      'sessions.session_id',
      'webhooks.url',
      'webhooks.events',
      'webhooks.is_active',
      'webhooks.failed_attempts',
      'webhooks.created_at'
    );

    res.json({
      success: true,
      data: { webhooks }
    });
  } catch (error) {
    logger.error('Get webhooks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_WEBHOOKS_FAILED',
        message: 'Failed to fetch webhooks'
      }
    });
    return;
  }
});

// Update webhook
router.put('/:webhookId', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { webhookId } = req.params;
    const { url, events, isActive } = req.body;

    const webhook = await db('webhooks')
      .join('sessions', 'webhooks.session_id', 'sessions.id')
      .where({ 'webhooks.id': webhookId, 'sessions.user_id': req.user.id })
      .first();

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
      return;
    }

    const updates: any = { updated_at: db.fn.now() };
    if (url) updates.url = url;
    if (events) updates.events = events;
    if (typeof isActive === 'boolean') updates.is_active = isActive;

    await db('webhooks').where({ id: webhookId }).update(updates);

    logger.info(`Webhook updated: ${webhookId}`);

    res.json({
      success: true,
      message: 'Webhook updated successfully'
    });
  } catch (error) {
    logger.error('Update webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_UPDATE_FAILED',
        message: 'Failed to update webhook'
      }
    });
    return;
  }
});

// Delete webhook
router.delete('/:webhookId', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { webhookId } = req.params;

    const webhook = await db('webhooks')
      .join('sessions', 'webhooks.session_id', 'sessions.id')
      .where({ 'webhooks.id': webhookId, 'sessions.user_id': req.user.id })
      .first();

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found'
        }
      });
      return;
    }

    await db('webhooks').where({ id: webhookId }).delete();

    logger.info(`Webhook deleted: ${webhookId}`);

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    logger.error('Delete webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_DELETE_FAILED',
        message: 'Failed to delete webhook'
      }
    });
    return;
  }
});

export default router;
