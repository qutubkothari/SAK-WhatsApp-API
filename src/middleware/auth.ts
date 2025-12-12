import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database';

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

    const session = await db('sessions')
      .where({ api_key: apiKey, is_active: true })
      .first();

    if (!session) {
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
      .where({ id: session.user_id, is_active: true })
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
