import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '../models/User';

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;

    // Verify tenant boundary: user token must match tenant of the request
    if (req.tenantId && decoded.tenantId !== req.tenantId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant mismatch: Access denied to foreign tenant resources',
      });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Access token expired. Please rotate using refresh token.',
      });
    }
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'Authentication token is invalid',
    });
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
    if (!req.tenantId || decoded.tenantId === req.tenantId) {
      req.user = decoded;
    }
  } catch (error) {
    // Ignore invalid/expired token in optional mode
  }
  next();
}
