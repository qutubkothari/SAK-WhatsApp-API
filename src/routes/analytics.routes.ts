import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Get usage statistics
router.get('/usage', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const hasUsageTable = await db.schema.hasTable('usage_stats');
    if (!hasUsageTable) {
      res.json({
        success: true,
        data: {
          daily: [],
          summary: {
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalMessagesFailed: 0,
            totalApiCalls: 0
          }
        }
      });
      return;
    }

    let query = db('usage_stats').where({ user_id: req.user.id });

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const stats = await query.orderBy('date', 'desc').limit(30);

    const summary = await db('usage_stats')
      .where({ user_id: req.user.id })
      .sum('messages_sent as totalSent')
      .sum('messages_received as totalReceived')
      .sum('messages_failed as totalFailed')
      .sum('api_calls as totalApiCalls')
      .first();

    res.json({
      success: true,
      data: {
        daily: stats,
        summary: {
          totalMessagesSent: Number(summary?.totalSent || 0) || 0,
          totalMessagesReceived: Number(summary?.totalReceived || 0) || 0,
          totalMessagesFailed: Number(summary?.totalFailed || 0) || 0,
          totalApiCalls: Number(summary?.totalApiCalls || 0) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Get usage stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USAGE_FAILED',
        message: 'Failed to fetch usage statistics'
      }
    });
  }
});

// Get session analytics
router.get('/sessions', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const sessions = await db('sessions')
      .where({ user_id: req.user.id })
      .select('id', 'session_id', 'name', 'status', 'phone_number', 'created_at');

    const sessionStats = await Promise.all(
      sessions.map(async (session) => {
        const messages = await db('messages')
          .where({ session_id: session.id })
          .count('* as total')
          .sum({ sent: db.raw("CASE WHEN status = 'sent' THEN 1 ELSE 0 END") })
          .sum({ failed: db.raw("CASE WHEN status = 'failed' THEN 1 ELSE 0 END") })
          .first();

        const total = Number((messages as any)?.total || 0) || 0;
        const sent = Number((messages as any)?.sent || 0) || 0;
        const failed = Number((messages as any)?.failed || 0) || 0;

        return {
          ...session,
          messageStats: { total, sent, failed }
        };
      })
    );

    res.json({
      success: true,
      data: { sessions: sessionStats }
    });
  } catch (error) {
    logger.error('Get session analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ANALYTICS_FAILED',
        message: 'Failed to fetch session analytics'
      }
    });
  }
});

// Get activity logs
router.get('/activity', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await db('activity_logs')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('action', 'metadata', 'ip_address', 'created_at');

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    logger.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ACTIVITY_FAILED',
        message: 'Failed to fetch activity logs'
      }
    });
  }
});

export default router;
