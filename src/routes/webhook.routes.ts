import { Router, Response } from 'express';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, validateApiKey } from '../middleware/auth';
import logger from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

function normalizeWebhookEvents(inputEvents: unknown): string[] {
  if (!Array.isArray(inputEvents)) return [];

  const normalized: string[] = [];
  for (const rawEvent of inputEvents) {
    if (typeof rawEvent !== 'string') continue;
    const event = rawEvent.trim();
    if (!event) continue;

    // Public aliases -> internal canonical events
    if (event === 'message') normalized.push('message.received');
    else if (event === 'session') normalized.push('session.status');
    else normalized.push(event);
  }

  // De-dupe while preserving order
  return Array.from(new Set(normalized));
}

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

    const normalizedEvents = normalizeWebhookEvents(events);
    if (normalizedEvents.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'events array must include at least one valid event'
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

    // Idempotent create: reuse existing webhook (and its secret) for same session+url.
    // This avoids accumulating duplicates and unintentionally rotating secrets.
    const existingWebhooks = await db('webhooks')
      .where({ session_id: session.id, url })
      .orderBy('created_at', 'asc');

    const canonicalWebhook = existingWebhooks.find((w: any) => w.is_active) ?? existingWebhooks[0];

    if (canonicalWebhook) {
      await db('webhooks')
        .where({ id: canonicalWebhook.id })
        .update({
          events: normalizedEvents,
          is_active: true
        });

      const duplicateIds = existingWebhooks
        .filter((w: any) => w.id !== canonicalWebhook.id)
        .map((w: any) => w.id);

      if (duplicateIds.length > 0) {
        await db('webhooks').whereIn('id', duplicateIds).update({ is_active: false });
      }

      logger.info(`Webhook updated (reused) for session ${sessionId}`);

      res.status(200).json({
        success: true,
        data: {
          webhookId: canonicalWebhook.id,
          url,
          secret: canonicalWebhook.secret,
          events: normalizedEvents
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
      events: normalizedEvents,
      created_at: db.fn.now()
    });

    logger.info(`Webhook created for session ${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        webhookId,
        url,
        secret,
        events: normalizedEvents
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

// Test webhook delivery (API key auth)
// This endpoint is for integration testing: it sends a signed test payload to the configured webhook(s).
router.post('/test', validateApiKey, async (req: any, res: Response): Promise<void> => {
  try {
    const session = (req as any).session;
    if (!session) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_REQUIRED',
          message: 'Session is required (provide x-session-id or sessionId)'
        }
      });
      return;
    }

    const { url, webhookId, event, message } = req.body || {};
    const testEvent = typeof event === 'string' && event.trim() ? event.trim() : 'message.received';

    let query = db('webhooks')
      .where({ session_id: session.id, is_active: true })
      .select('id', 'url', 'secret');

    if (webhookId) query = query.where({ id: webhookId });
    if (url) query = query.where({ url });

    const webhooks = await query;
    if (!webhooks || webhooks.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'No active webhook found for this session (and optional url/webhookId filter)'
        }
      });
      return;
    }

    const payload = {
      event: testEvent,
      sessionId: session.session_id,
      timestamp: new Date().toISOString(),
      test: true,
      text: typeof message === 'string' && message.trim() ? message.trim() : 'SAK webhook live test'
    };

    const results = await Promise.all(
      webhooks.map(async (w: any) => {
        const payloadStr = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', w.secret).update(payloadStr).digest('hex');

        try {
          const resp = await axios.post(w.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': w.secret,
              'X-Webhook-Signature': `sha256=${signature}`,
              'X-Webhook-Event': payload.event
            },
            timeout: 8000,
            validateStatus: () => true
          });

          const ok = resp.status >= 200 && resp.status < 300;
          const responsePreview =
            typeof resp.data === 'string'
              ? resp.data.slice(0, 500)
              : JSON.stringify(resp.data).slice(0, 500);

          return { webhookId: w.id, url: w.url, ok, status: resp.status, responsePreview };
        } catch (err: any) {
          return {
            webhookId: w.id,
            url: w.url,
            ok: false,
            status: null,
            error: err?.message || 'Request failed'
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        sessionId: session.session_id,
        event: payload.event,
        attempted: results.length,
        results
      }
    });
  } catch (error) {
    logger.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_TEST_FAILED',
        message: 'Failed to test webhook'
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

    const updates: any = {};
    if (url) updates.url = url;
    if (events) {
      const normalizedEvents = normalizeWebhookEvents(events);
      if (normalizedEvents.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'events array must include at least one valid event'
          }
        });
        return;
      }
      updates.events = normalizedEvents;
    }
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
