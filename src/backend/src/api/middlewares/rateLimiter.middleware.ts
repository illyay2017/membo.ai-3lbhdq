import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { redisManager } from '../../config/redis';
import { ErrorCodes } from '../../constants/errorCodes';

// Default rate limit window in milliseconds (1 minute)
const DEFAULT_WINDOW_MS = 60000;

// Default maximum requests per window
const DEFAULT_MAX_REQUESTS = 100;

// Redis key prefix for rate limiting
const RATE_LIMIT_PREFIX = 'ratelimit:';

// Rate limits by user tier (requests per minute)
const USER_TIER_LIMITS = {
  FREE: parseInt(process.env.RATE_LIMIT_FREE_TIER || '100', 10),
  PRO: parseInt(process.env.RATE_LIMIT_PRO_TIER || '1000', 10),
  POWER: 2000
};

// Burst multiplier for temporary rate increase
const BURST_MULTIPLIER = 1.5;

// Gradual rate limit increment percentage
const GRADUAL_INCREMENT = 0.1;

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  skipFailedRequests?: boolean;
  keyPrefix?: string;
  enableBursting?: boolean;
  burstMultiplier?: number;
  enableGradual?: boolean;
  gradualIncrement?: number;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}

/**
 * Creates a Redis-based distributed rate limiter middleware using token bucket algorithm
 * Supports user tiers, bursting, and graduated rate limiting
 */
export const rateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.max || DEFAULT_MAX_REQUESTS;
  const keyPrefix = options.keyPrefix || RATE_LIMIT_PREFIX;
  const skipFailedRequests = options.skipFailedRequests || false;
  const enableBursting = options.enableBursting || false;
  const burstMultiplier = options.burstMultiplier || BURST_MULTIPLIER;
  const enableGradual = options.enableGradual || false;
  const gradualIncrement = options.gradualIncrement || GRADUAL_INCREMENT;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get user tier from request (assuming auth middleware sets this)
      const userTier = (req.user?.tier || 'FREE') as keyof typeof USER_TIER_LIMITS;
      const baseLimit = USER_TIER_LIMITS[userTier];

      // Generate rate limit key using user ID or IP
      const identifier = req.user?.id || req.ip;
      const key = `${keyPrefix}${userTier.toLowerCase()}:${identifier}`;

      // Start Redis transaction
      const multi = redisManager['client'].multi();

      // Get current count and timestamp
      const [currentCount, lastRequest] = await Promise.all([
        redisManager.get<number>(key),
        redisManager.get<number>(`${key}:ts`)
      ]);

      const now = Date.now();
      const resetTime = lastRequest ? lastRequest + windowMs : now + windowMs;
      
      // Calculate effective limit with bursting if enabled
      let effectiveLimit = baseLimit;
      if (enableBursting) {
        const burstKey = `${key}:burst`;
        const burstCount = await redisManager.get<number>(burstKey);
        if (!burstCount) {
          effectiveLimit = Math.floor(baseLimit * burstMultiplier);
          await redisManager.set(burstKey, 1, { ttl: 60 }); // 1 minute burst window
        }
      }

      // Apply graduated rate limiting if enabled
      if (enableGradual && currentCount) {
        const gradualIncrease = Math.floor(baseLimit * gradualIncrement);
        effectiveLimit = Math.min(
          baseLimit + gradualIncrease,
          currentCount + gradualIncrease
        );
      }

      // Check if rate limit is exceeded
      const count = currentCount || 0;
      if (count >= effectiveLimit) {
        // Return RFC 7807 compliant error response
        res.status(429).json({
          type: 'https://api.membo.ai/problems/rate-limit-exceeded',
          title: 'Rate limit exceeded',
          status: 429,
          detail: `Request rate limit of ${effectiveLimit} requests per ${windowMs}ms has been exceeded`,
          instance: req.originalUrl,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        });
        return;
      }

      // Update request count and timestamp
      multi.incr(key);
      multi.pexpire(key, windowMs);
      multi.set(`${key}:ts`, now);
      await multi.exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', effectiveLimit);
      res.setHeader('X-RateLimit-Remaining', effectiveLimit - count - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

      // Skip failed requests if enabled
      if (skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function(...args: any[]): any {
          if (res.statusCode >= 400) {
            redisManager.get<number>(key).then(current => {
              if (current) {
                redisManager['client'].decr(key);
              }
            }).catch(() => {
              // Ignore decrement errors
            });
          }
          return originalEnd.apply(res, args);
        };
      }

      next();
    } catch (error) {
      // Log error and allow request to proceed
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

export default rateLimiter;