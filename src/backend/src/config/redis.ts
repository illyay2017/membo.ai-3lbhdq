import Redis, { RedisOptions, Cluster } from 'ioredis'; // v5.3.0
import pino from 'pino'; // v8.16.0
import { EventEmitter } from 'events';

// Global configuration object based on best practices and requirements
const REDIS_CONFIG = {
  cluster: {
    enabled: true,
    retryDelayMs: 5000,
    maxRedirections: 16,
    scaleReads: 'slave' as const,
    clusterRetryStrategy: (times: number) => Math.min(times * 50, 2000),
  },
  defaults: {
    ttlSeconds: 900, // 15 minutes default TTL
    maxMemoryMB: 5120, // 5GB initial allocation
    keyPrefix: 'membo:',
    connectionTimeout: 10000,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResendUnfulfilledCommands: true,
    maxLoadingRetryTime: 10000,
  },
  monitoring: {
    healthCheckIntervalMs: 5000,
    memoryAlertThreshold: 0.8,
    slowLogThresholdMs: 100,
  },
  security: {
    enableTLS: true,
    rejectUnauthorized: true,
    passwordRotationDays: 30,
    maxClientsPerNode: 1000,
  },
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

class RedisManager {
  private client: Redis.Cluster | Redis;
  private logger: pino.Logger;
  private healthCheckInterval: NodeJS.Timer;
  private retryCounters: Map<string, number>;
  private eventBus: EventEmitter;
  private healthStatus: HealthStatus;

  constructor() {
    this.logger = pino({
      name: 'redis-manager',
      level: process.env.LOG_LEVEL || 'info',
    });
    this.retryCounters = new Map();
    this.eventBus = new EventEmitter();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is required');
      }

      const baseOptions: RedisOptions = {
        connectTimeout: REDIS_CONFIG.defaults.connectionTimeout,
        maxRetriesPerRequest: REDIS_CONFIG.defaults.maxRetriesPerRequest,
        enableReadyCheck: REDIS_CONFIG.defaults.enableReadyCheck,
        autoResendUnfulfilledCommands: REDIS_CONFIG.defaults.autoResendUnfulfilledCommands,
        keyPrefix: REDIS_CONFIG.defaults.keyPrefix,
        tls: REDIS_CONFIG.security.enableTLS ? {
          rejectUnauthorized: REDIS_CONFIG.security.rejectUnauthorized,
        } : undefined,
        retryStrategy: (times: number) => {
          const delay = REDIS_CONFIG.cluster.clusterRetryStrategy(times);
          this.logger.warn({ times, delay }, 'Redis connection retry');
          return delay;
        },
      };

      if (REDIS_CONFIG.cluster.enabled) {
        this.client = new Redis.Cluster([redisUrl], {
          ...baseOptions,
          scaleReads: REDIS_CONFIG.cluster.scaleReads,
          maxRedirections: REDIS_CONFIG.cluster.maxRedirections,
          clusterRetryStrategy: REDIS_CONFIG.cluster.clusterRetryStrategy,
        });
      } else {
        this.client = new Redis(redisUrl, baseOptions);
      }

      this.setupEventHandlers();
      this.startHealthCheck();
      this.configureMemoryLimits();

      await this.validateConnection();
      this.logger.info('Redis client initialized successfully');
    } catch (error) {
      this.logger.error(error, 'Failed to initialize Redis client');
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      this.logger.error(error, 'Redis client error');
      this.eventBus.emit('error', error);
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

  private async configureMemoryLimits(): Promise<void> {
    try {
      await this.client.config('SET', 'maxmemory', `${REDIS_CONFIG.defaults.maxMemoryMB}mb`);
      await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru');
    } catch (error) {
      this.logger.error(error, 'Failed to configure memory limits');
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

  private async getClusterNodes(): Promise<string[]> {
    if (this.client instanceof Redis.Cluster) {
      return this.client.nodes('master').map(node => node.options.host);
    }
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
}

// Export singleton instance
export const redisManager = new RedisManager();

// Export initialization function
export async function initializeRedis(): Promise<void> {
  try {
    await redisManager['initialize']();
  } catch (error) {
    throw new Error(`Redis initialization failed: ${error.message}`);
  }
}