import { RedisService } from "./RedisService";

export class RateLimiterService {
  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    key: string,
    maxAttempts: number,
    windowMs: number,
    options?: {
      blockDuration?: number;
      prefix?: string;
    }
  ): Promise<boolean> {
    const prefix = options?.prefix || 'rate_limit';
    const redisKey = `${prefix}:${key}`;
    const count = await this.redisService.get(redisKey);
    
    if (!count) {
      await this.redisService.set(redisKey, '1', Math.floor(windowMs / 1000));
      return true;
    }

    const attempts = parseInt(count);
    if (attempts >= maxAttempts) {
      if (options?.blockDuration) {
        await this.redisService.set(
          redisKey, 
          String(attempts),
          Math.floor(options.blockDuration / 1000)
        );
      }
      return false;
    }

    await this.redisService.set(
      redisKey,
      String(attempts + 1),
      Math.floor(windowMs / 1000)
    );
    return true;
  }

  async getRemainingAttempts(key: string, prefix?: string): Promise<number> {
    const redisKey = `${prefix || 'rate_limit'}:${key}`;
    const count = await this.redisService.get(redisKey);
    return count ? parseInt(count) : 0;
  }
}
