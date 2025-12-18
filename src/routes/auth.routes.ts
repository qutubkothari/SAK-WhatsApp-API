import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Register
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User already exists'
        }
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db('users').insert({
      id: userId,
      email,
      password_hash: hashedPassword,
      full_name: name || email.split('@')[0],
      plan: 'free',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    await db('activity_logs').insert({
      id: uuidv4(),
      user_id: userId,
      action: 'user.registered',
      ip_address: req.ip,
      created_at: db.fn.now()
    });

    const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
      expiresIn: '7d'
    });

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          email,
          name: name || email.split('@')[0],
          plan: 'free'
        }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed'
      }
    });
  }
});

// Login
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: '7d'
    });

    await db('activity_logs').insert({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.login',
      ip_address: req.ip,
      created_at: db.fn.now()
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          plan: user.plan
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed'
      }
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'full_name', 'plan', 'created_at')
      .first();

    const apiUser = user
      ? {
          id: (user as any).id,
          email: (user as any).email,
          name: (user as any).full_name,
          plan: (user as any).plan,
          created_at: (user as any).created_at
        }
      : user;

    res.json({
      success: true,
      data: { user: apiUser }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USER_FAILED',
        message: 'Failed to fetch user data'
      }
    });
  }
});

// Create a stable user API key (shown once)
router.post('/api-keys', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const { name = 'default' } = req.body || {};

    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const lastFour = rawKey.slice(-4);

    const [apiKey] = await db('api_keys')
      .insert({
        id: uuidv4(),
        user_id: req.user.id,
        key_hash: keyHash,
        name,
        last_four: lastFour,
        is_active: true,
        created_at: db.fn.now()
      })
      .returning(['id', 'name', 'last_four', 'created_at']);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey?.id,
        name: apiKey?.name,
        key: rawKey,
        lastFour,
        createdAt: apiKey?.created_at
      }
    });
  } catch (error) {
    logger.error('Create user API key error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_CREATE_FAILED',
        message: 'Failed to create API key'
      }
    });
  }
});

// List your API keys (does not return raw key)
router.get('/api-keys', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    const keys = await db('api_keys')
      .where({ user_id: req.user.id })
      .select('id', 'name', 'last_four', 'is_active', 'created_at', 'last_used_at', 'expires_at')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { keys }
    });
  } catch (error) {
    logger.error('List user API keys error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEYS_FETCH_FAILED',
        message: 'Failed to fetch API keys'
      }
    });
  }
});

export default router;

