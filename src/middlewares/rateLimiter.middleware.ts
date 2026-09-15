import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../config';
import { logger } from '../observability/logger';

// Token Bucket in-memory / distributed rate limiters
const generalLimiter = new RateLimiterMemory({
  points: config.rateLimit.maxPoints,
  duration: Math.floor(config.rateLimit.windowMs / 1000),
  blockDuration: 60,
});

const authLimiter = new RateLimiterMemory({
  points: 20,
  duration: 900,
  blockDuration: 900,
});

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip observability endpoints
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }

  const key = `${req.tenantId || 'global'}_${req.ip || '127.0.0.1'}`;
  try {
    const rateRes = await generalLimiter.consume(key);
    res.setHeader('X-RateLimit-Limit', config.rateLimit.maxPoints);
    res.setHeader('X-RateLimit-Remaining', rateRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateRes.msBeforeNext).toISOString());
    next();
  } catch (rateLimiterRes: any) {
    if (rateLimiterRes instanceof Error) {
      logger.error({ err: rateLimiterRes }, 'Rate limiter internal error, failing open');
      return next();
    }
    logger.warn({ key }, 'Rate limit exceeded');
    res.setHeader('Retry-After', Math.round((rateLimiterRes.msBeforeNext || 60000) / 1000));
    return res.status(429).json({
      error: 'TooManyRequests',
      message: 'Rate limit exceeded. Please throttle your requests.',
      retryAfterSeconds: Math.round((rateLimiterRes.msBeforeNext || 60000) / 1000),
    });
  }
}

export async function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = `auth_${req.tenantId || 'global'}_${req.ip || '127.0.0.1'}`;
  try {
    await authLimiter.consume(key);
    next();
  } catch (rateLimiterRes: any) {
    if (rateLimiterRes instanceof Error) {
      return next();
    }
    logger.warn({ key }, 'Auth brute force limit hit');
    return res.status(429).json({
      error: 'TooManyRequests',
      message: 'Too many authentication attempts. Account temporarily locked for 15 minutes.',
    });
  }
}
