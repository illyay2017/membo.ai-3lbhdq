import Redis, { RedisOptions } from 'ioredis';
import winston from 'winston';
import { EventEmitter } from 'events';

const REDIS_CONFIG = {
  defaults: {
    url: process.env.REDIS_URL || 'redis://cache:6379',
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  },
  monitoring: {
    healthCheckIntervalMs: 5000,
  }
};

interface SetOptions {
  ttl?: number;
  nx?: boolean;
  xx?: boolean;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  nodes: {
    address: string;
    status: string;
    memoryUsage: number;
  }[];
  lastCheck: Date;
}

export class RedisManager {
  private static instance: RedisManager;
  private client: Redis;
  private readonly logger: winston.Logger;
  private healthCheckInterval: NodeJS.Timer;
  private retryCounters: Map<string, number>;
  private eventBus: EventEmitter;
  private healthStatus: HealthStatus;

  private constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    this.retryCounters = new Map();
    this.eventBus = new EventEmitter();
    
    this.logger.info('Creating Redis client with config:', {
      host: 'cache',
      port: 6379,
      retryStrategy: REDIS_CONFIG.defaults.retryStrategy,
      maxRetriesPerRequest: REDIS_CONFIG.defaults.maxRetriesPerRequest,
      enableReadyCheck: REDIS_CONFIG.defaults.enableReadyCheck
    });

    // Use proper connection options as per ioredis docs
    this.client = new Redis({
      host: 'cache', // Docker service name
      port: 6379,
      retryStrategy: REDIS_CONFIG.defaults.retryStrategy,
      maxRetriesPerRequest: REDIS_CONFIG.defaults.maxRetriesPerRequest,
      enableReadyCheck: REDIS_CONFIG.defaults.enableReadyCheck,
      showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
    });

    this.setupEventListeners();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private setupEventListeners(): void {
    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
      this.eventBus.emit('error', err);
    });

    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
      this.eventBus.emit('connect');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
      this.eventBus.emit('ready');
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client connection closed');
      this.eventBus.emit('close');
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.validateConnection();
      this.logger.info('Redis client initialized successfully');
      this.startHealthCheck();
      this.configureMemoryLimits();
    } catch (error) {
      this.logger.error(error, 'Failed to initialize Redis client');
      throw error;
    }
  }

  private async validateConnection(): Promise<void> {
    try {
      await this.client.ping();
    } catch (error) {
      this.logger.error(error, 'Redis connection validation failed');
      throw error;
    }
  }

  private async configureMemoryLimits(): Promise<void> {
    try {
      // Set a reasonable default memory limit for development
      const maxMemoryMB = process.env.REDIS_MAX_MEMORY_MB || '512';
      await this.client.config('SET', 'maxmemory', `${maxMemoryMB}mb`);
      await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru');
    } catch (error) {
      this.logger.error(error, 'Failed to configure memory limits');
      // Don't throw - this is non-critical for development
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const nodes = await this.getClusterNodes();
        const status = await this.checkHealth(nodes);
        this.healthStatus = {
          status: status.every(s => s.status === 'healthy') ? 'healthy' : 'degraded',
          nodes: status,
          lastCheck: new Date(),
        };
      } catch (error) {
        this.logger.error(error, 'Health check failed');
        this.healthStatus = {
          status: 'unhealthy',
          nodes: [],
          lastCheck: new Date(),
        };
      }
    }, REDIS_CONFIG.monitoring.healthCheckIntervalMs);
  }

  private async getClusterNodes(): Promise<string[]> {
    return [this.client.options.host as string];
  }

  private async checkHealth(nodes: string[]): Promise<{ address: string; status: string; memoryUsage: number; }[]> {
    const checks = nodes.map(async (node) => {
      try {
        const info = await this.client.info('memory');
        const memoryUsage = this.parseMemoryUsage(info);
        return {
          address: node,
          status: 'healthy',
          memoryUsage,
        };
      } catch (error) {
        return {
          address: node,
          status: 'unhealthy',
          memoryUsage: 0,
        };
      }
    });
    return Promise.all(checks);
  }

  private parseMemoryUsage(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  public async set(key: string, value: any, options: SetOptions = {}): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const ttl = options.ttl || parseInt(process.env.REDIS_TTL || '900', 10);

      if (options.nx) {
        await this.client.set(key, serializedValue, 'NX', 'EX', ttl);
      } else if (options.xx) {
        await this.client.set(key, serializedValue, 'XX', 'EX', ttl);
      } else {
        await this.client.set(key, serializedValue, 'EX', ttl);
      }
    } catch (error) {
      this.logger.error({ key, error }, 'Failed to set Redis key');
      throw error;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error({ key, error }, 'Failed to get Redis key');
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error({ key, error }, 'Failed to delete Redis key');
      throw error;
    }
  }

  public getHealth(): HealthStatus {
    return this.healthStatus;
  }

  public async getMetrics(): Promise<any> {
    try {
      const info = await this.client.info();
      return this.parseMetrics(info);
    } catch (error) {
      this.logger.error(error, 'Failed to get Redis metrics');
      throw error;
    }
  }

  private parseMetrics(info: string): any {
    // Parse Redis INFO command output into structured metrics
    const metrics: any = {};
    const sections = info.split('\n\r\n');
    
    sections.forEach(section => {
      const lines = section.split('\n');
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          metrics[key] = value;
        }
      });
    });
    
    return metrics;
  }

  public shutdown(): void {
    clearInterval(this.healthCheckInterval);
    this.client.disconnect();
  }

  public getClient(): Redis {
    return this.client;
  }

  public async ping(): Promise<string> {
    return this.client.ping();
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

// Export the Redis client for use throughout the application
export const redisClient = redisManager.getClient();
