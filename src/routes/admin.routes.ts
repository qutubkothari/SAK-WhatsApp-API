import { Router, Response } from 'express';
import db from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Get all users (admin only)
router.get('/users', authenticate, isAdmin, async (_req: any, res: Response): Promise<void> => {
  try {
    const users = await db('users')
      .select(
        'id',
        'email',
        db.raw('full_name as name'),
        'plan',
        'stripe_customer_id',
        'is_active',
        'created_at'
      )
      .orderBy('created_at', 'desc');

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const sessions = await db('sessions')
          .where({ user_id: user.id })
          .count('* as count')
          .first();

        const messages = await db('messages')
          .join('sessions', 'messages.session_id', 'sessions.id')
          .where({ 'sessions.user_id': user.id })
          .count('* as count')
          .first();

        return {
          ...user,
          sessionCount: Number(sessions?.count || 0) || 0,
          messageCount: Number(sessions?.count || 0) || 0
        };
      })
    );

    res.json({
      success: true,
      data: { users: usersWithStats }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USERS_FAILED',
        message: 'Failed to fetch users'
      }
    });
    return;
  }
});

// Get platform statistics
router.get('/stats', authenticate, isAdmin, async (_req: any, res: Response): Promise<void> => {
  try {
    const totalUsers = await db('users').count('* as count').first();
    const activeUsers = await db('users').where({ is_active: true }).count('* as count').first();
    const totalSessions = await db('sessions').count('* as count').first();
    const activeSessions = await db('sessions').where({ status: 'connected' }).count('* as count').first();
    const totalMessages = await db('messages').count('* as count').first();

    const planDistribution = await db('users')
      .select('plan')
      .count('* as count')
      .groupBy('plan');

    const recentActivity = await db('activity_logs')
      .orderBy('created_at', 'desc')
      .limit(100)
      .select('user_id', 'action', 'ip_address', 'created_at');

    res.json({
      success: true,
      data: {
        totalUsers: Number(totalUsers?.count || 0) || 0,
        activeUsers: Number(activeUsers?.count || 0) || 0,
        totalSessions: Number(totalSessions?.count || 0) || 0,
        activeSessions: Number(activeSessions?.count || 0) || 0,
        totalMessages: Number(totalMessages?.count || 0) || 0,
        planDistribution,
        recentActivity
      }
    });
  } catch (error) {
    logger.error('Get platform stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATS_FAILED',
        message: 'Failed to fetch platform statistics'
      }
    });
    return;
  }
});

// Update user plan (admin only)
router.put('/users/:userId/plan', authenticate, isAdmin, async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!['free', 'starter', 'pro', 'enterprise'].includes(plan)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid plan type'
        }
      });
      return;
    }

    await db('users').where({ id: userId }).update({
      plan,
      updated_at: db.fn.now()
    });

    logger.info(`User plan updated: ${userId} to ${plan}`);

    res.json({
      success: true,
      message: 'User plan updated successfully'
    });
  } catch (error) {
    logger.error('Update user plan error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PLAN_FAILED',
        message: 'Failed to update user plan'
      }
    });
    return;
  }
});

// Deactivate user (admin only)
router.put('/users/:userId/deactivate', authenticate, isAdmin, async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    await db('users').where({ id: userId }).update({
      is_active: false,
      updated_at: db.fn.now()
    });

    // Disconnect all sessions
    await db('sessions').where({ user_id: userId }).update({
      is_active: false,
      status: 'disconnected',
      updated_at: db.fn.now()
    });

    logger.info(`User deactivated: ${userId}`);

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEACTIVATE_USER_FAILED',
        message: 'Failed to deactivate user'
      }
    });
    return;
  }
});

// Create API key (admin only, primarily to support legacy onboarding calls)
router.post('/api-keys', authenticate, isAdmin, async (req: any, res: Response): Promise<void> => {
  try {
    const { name = 'admin-key', userId } = req.body;
    const targetUserId = userId || req.user.id;

    const user = await db('users').where({ id: targetUserId }).first();
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
      return;
    }

    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const lastFour = rawKey.slice(-4);

    const [apiKey] = await db('api_keys')
      .insert({
        user_id: targetUserId,
        key_hash: keyHash,
        name,
        last_four: lastFour,
        created_at: db.fn.now()
      })
      .returning(['id', 'name', 'last_four', 'created_at']);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        lastFour,
        createdAt: apiKey.created_at
      }
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_CREATE_FAILED',
        message: 'Failed to create API key'
      }
    });
    return;
  }
});

// List API keys (admin only)
router.get('/api-keys', authenticate, isAdmin, async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    let query = db('api_keys').select('id', 'user_id', 'name', 'last_four', 'is_active', 'created_at', 'last_used_at');
    if (userId) {
      query = query.where({ user_id: userId });
    }
    const keys = await query.orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { keys }
    });
  } catch (error) {
    logger.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEYS_FETCH_FAILED',
        message: 'Failed to fetch API keys'
      }
    });
    return;
  }
});

export default router;
