import { redisClient } from '../config/redis';
import Redis from 'ioredis';

export class RedisService {
  private static instance: RedisService;
  private readonly client: Redis;
  
  // Prefix constants
  public readonly PREFIX = {
    TOKEN_BLACKLIST: 'token:blacklist:',
    REFRESH_TOKEN: 'refresh:token:',
    SESSION: 'session:',
    RATE_LIMIT: 'ratelimit:',
    ROLE_CACHE: 'role:',
  };

  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.client = redisClient;
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  // Token operations
  async storeRefreshToken(userId: string, tokenId: string, token: string): Promise<void> {
    const key = `${this.PREFIX.REFRESH_TOKEN}${userId}:${tokenId}`;
    await this.client.set(key, token, 'EX', 7 * 24 * 60 * 60); // 7 days
  }

  async blacklistToken(tokenId: string, expiryTime: number): Promise<void> {
    const key = `${this.PREFIX.TOKEN_BLACKLIST}${tokenId}`;
    const ttl = Math.floor((expiryTime * 1000 - Date.now()) / 1000);
    await this.client.set(key, 'blacklisted', 'EX', ttl);
  }

  // Rate limiting operations
  async incrementRateLimit(key: string, windowMs: number): Promise<number> {
    const rateKey = `${this.PREFIX.RATE_LIMIT}${key}`;
    const count = await this.client.incr(rateKey);
    if (count === 1) {
      await this.client.pexpire(rateKey, windowMs);
    }
    return count;
  }

  // Role caching operations
  async getCachedRole(userId: string): Promise<string | null> {
    return this.client.get(`${this.PREFIX.ROLE_CACHE}${userId}`);
  }

  // Session operations
  async manageSession(userId: string, sessionData: any): Promise<void> {
    const key = `${this.PREFIX.SESSION}${userId}`;
    await this.client.set(key, JSON.stringify(sessionData));
  }

  // Cleanup utilities
  async cleanup(): Promise<void> {
    // Implement periodic cleanup logic
  }

  public startCleanupTasks(): void {
    this.cleanupInterval = setInterval(async () => {
      await Promise.all([
        this.cleanupBlacklistedTokens(),
        this.cleanupExpiredSessions(),
        this.cleanupRateLimiters()
      ]);
    }, 60 * 60 * 1000); // Run every hour
  }

  private async cleanupBlacklistedTokens(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.PREFIX.TOKEN_BLACKLIST}*`);
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl <= 0) {
          await this.client.del(key);
        }
      }
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    // Similar cleanup for expired sessions
  }

  private async cleanupRateLimiters(): Promise<void> {
    // Cleanup expired rate limiter keys
  }

  // Call this when shutting down the application
  public stopCleanupTasks(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // Graceful shutdown
  async quit(): Promise<void> {
    await this.client.quit();
  }

  // Generic operations
  async set(key: string, value: string, expireSeconds?: number): Promise<'OK'> {
    if (expireSeconds) {
      return this.client.set(key, value, 'EX', expireSeconds);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  // Add these methods to RedisService class
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Creates a Redis transaction/pipeline
   */
  async multi(): Promise<ReturnType<Redis['multi']>> {
    return this.client.multi();
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
}
