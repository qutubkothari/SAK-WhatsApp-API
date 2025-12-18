import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication token required'
        }
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const user = await db('users')
      .where({ id: decoded.userId, is_active: true })
      .first();

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: 'Authentication failed'
      }
    });
    return;
  }
};

export const validateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'API key required in x-api-key header'
        }
      });
      return;
    }

    // Backward compatible: per-session API key
    const sessionByKey = await db('sessions')
      .where({ api_key: apiKey, is_active: true })
      .first();

    if (sessionByKey) {
      const user = await db('users')
        .where({ id: sessionByKey.user_id, is_active: true })
        .first();

      if (!user) {
        res.status(403).json({
          success: false,
          error: {
            code: 'USER_INACTIVE',
            message: 'User account is inactive'
          }
        });
        return;
      }

      req.user = user;
      (req as any).session = sessionByKey;
      next();
      return;
    }

    // Stable user-level API key (api_keys table)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const userKey = await db('api_keys')
      .where({ key_hash: keyHash, is_active: true })
      .first();

    if (!userKey) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or inactive API key'
        }
      });
      return;
    }

    const user = await db('users')
      .where({ id: userKey.user_id, is_active: true })
      .first();

    if (!user) {
      res.status(403).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is inactive'
        }
      });
      return;
    }

    // With a user-level API key we must also know which session to use.
    const sessionExternalId =
      (req.headers['x-session-id'] as string) ||
      (req.query.sessionId as string) ||
      (req.body?.sessionId as string);

    if (!sessionExternalId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_ID_REQUIRED',
          message: 'sessionId is required (provide x-session-id header or sessionId in body/query)'
        }
      });
      return;
    }

    const session = await db('sessions')
      .where({ session_id: sessionExternalId, user_id: user.id, is_active: true })
      .first();

    if (!session) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Invalid or inactive session for this API key'
        }
      });
      return;
    }

    await db('api_keys')
      .where({ id: userKey.id })
      .update({ last_used_at: db.fn.now() });

    req.user = user;
    (req as any).session = session;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_VALIDATION_FAILED',
        message: 'API key validation failed'
      }
    });
    return;
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.email !== process.env.ADMIN_EMAIL) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
    return;
  }
  next();
};
