"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
exports.authRateLimiter = authRateLimiter;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const config_1 = require("../config");
const logger_1 = require("../observability/logger");
// Token Bucket in-memory / distributed rate limiters
const generalLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: config_1.config.rateLimit.maxPoints,
    duration: Math.floor(config_1.config.rateLimit.windowMs / 1000),
    blockDuration: 60,
});
const authLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 20,
    duration: 900,
    blockDuration: 900,
});
async function rateLimiter(req, res, next) {
    // Skip observability endpoints
    if (req.path === '/health' || req.path === '/metrics') {
        return next();
    }
    const key = `${req.tenantId || 'global'}_${req.ip || '127.0.0.1'}`;
    try {
        const rateRes = await generalLimiter.consume(key);
        res.setHeader('X-RateLimit-Limit', config_1.config.rateLimit.maxPoints);
        res.setHeader('X-RateLimit-Remaining', rateRes.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateRes.msBeforeNext).toISOString());
        next();
    }
    catch (rateLimiterRes) {
        if (rateLimiterRes instanceof Error) {
            logger_1.logger.error({ err: rateLimiterRes }, 'Rate limiter internal error, failing open');
            return next();
        }
        logger_1.logger.warn({ key }, 'Rate limit exceeded');
        res.setHeader('Retry-After', Math.round((rateLimiterRes.msBeforeNext || 60000) / 1000));
        return res.status(429).json({
            error: 'TooManyRequests',
            message: 'Rate limit exceeded. Please throttle your requests.',
            retryAfterSeconds: Math.round((rateLimiterRes.msBeforeNext || 60000) / 1000),
        });
    }
}
async function authRateLimiter(req, res, next) {
    const key = `auth_${req.tenantId || 'global'}_${req.ip || '127.0.0.1'}`;
    try {
        await authLimiter.consume(key);
        next();
    }
    catch (rateLimiterRes) {
        if (rateLimiterRes instanceof Error) {
            return next();
        }
        logger_1.logger.warn({ key }, 'Auth brute force limit hit');
        return res.status(429).json({
            error: 'TooManyRequests',
            message: 'Too many authentication attempts. Account temporarily locked for 15 minutes.',
        });
    }
}
