import Redis from "ioredis/built/Redis";

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expireSeconds?: number): Promise<'OK'>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  multi(): Promise<ReturnType<Redis['multi']>>;
  incr(key: string): Promise<number>;
  // ... other methods
}

export interface IRateLimiterService {
  checkRateLimit(key: string, maxAttempts: number, windowMs: number, options?: any): Promise<boolean>;
  // ... other methods
}

// ... other service interfaces 