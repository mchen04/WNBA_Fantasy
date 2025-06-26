import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';
import { Request, Response } from 'express';

// Redis-based store for distributed rate limiting
class RedisStore {
  windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redis = await getRedis();
    const multi = redis.multi();
    const redisKey = `rate-limit:${key}`;
    
    multi.incr(redisKey);
    multi.expire(redisKey, Math.ceil(this.windowMs / 1000));
    
    const results = await multi.exec();
    const totalHits = results?.[0] as number || 1;
    
    const ttl = await redis.ttl(redisKey);
    const resetTime = new Date(Date.now() + (ttl * 1000));
    
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redis = await getRedis();
    await redis.decr(`rate-limit:${key}`);
  }

  async resetKey(key: string): Promise<void> {
    const redis = await getRedis();
    await redis.del(`rate-limit:${key}`);
  }
}

// Create rate limiter instances
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(config.rateLimit.windowMs),
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

// Stricter rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(15 * 60 * 1000),
  skipSuccessfulRequests: true, // Don't count successful auth attempts
});

// Rate limiter for expensive operations (Pro/Pro+ features)
export const premiumRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 0;

    // Check user's subscription tier
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });

    switch (userData?.subscriptionTier) {
      case 'PRO_PLUS':
        return 1000; // Pro+ users get 1000 requests per hour
      case 'PRO':
        return 200; // Pro users get 200 requests per hour
      case 'FREE':
        return 20; // Free users get 20 requests per hour
      default:
        return 10;
    }
  },
  message: 'Rate limit exceeded for your subscription tier. Please upgrade for higher limits.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(60 * 60 * 1000),
});

// Webhook rate limiter (for Stripe)
export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 webhook calls per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(1 * 60 * 1000),
});

// Custom rate limit handler that tracks usage
export const trackUsage = async (
  req: Request,
  res: Response,
  feature: string
) => {
  const user = (req as any).user;
  if (!user) return;

  try {
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month

    await prisma.usageTracking.upsert({
      where: {
        userId_feature_period: {
          userId: user.id,
          feature,
          period,
        },
      },
      update: {
        count: { increment: 1 },
        lastUsed: now,
      },
      create: {
        userId: user.id,
        feature,
        period,
        subscriptionTier: user.subscriptionTier,
        count: 1,
        lastUsed: now,
      },
    });
  } catch (error) {
    // Don't throw error for usage tracking failures
    console.error('Usage tracking error:', error);
  }
};