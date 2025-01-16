/**
 * @fileoverview Database configuration module for PostgreSQL connections through Supabase
 * @version 1.0.0
 * @license MIT
 */

import { Pool, PoolConfig, QueryResult } from 'pg'; // v8.11.3
import pino, { Logger } from 'pino'; // v8.16.0
import CircuitBreaker from 'opossum'; // v7.1.0
import { ProcessEnv } from '../types/environment';
import supabase from './supabase';

/**
 * Database metrics collector interface
 */
interface MetricsCollector {
  queryTime: number[];
  poolSize: number;
  waitingCount: number;
  errorRate: number;
}

/**
 * Database configuration constants based on environment
 */
const DATABASE_CONFIG = {
  pool: {
    min: process.env.NODE_ENV === 'production' ? 2 : 1,
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 10000,
    query_timeout: 5000,
    application_name: 'membo.ai',
    keepalive: true,
    keepaliveInitialDelayMillis: 5000
  },
  readReplicas: {
    enabled: process.env.NODE_ENV === 'production',
    count: 2,
    strategy: 'round-robin',
    healthCheck: {
      enabled: true,
      intervalMs: 30000,
      timeoutMs: 5000
    }
  },
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.SSL_CERT,
    checkServerIdentity: true,
    minVersion: 'TLSv1.3'
  },
  security: {
    parameterValidation: true,
    sanitizeErrors: true,
    queryLogging: {
      enabled: true,
      sensitiveParams: ['password', 'token', 'key']
    }
  },
  monitoring: {
    enabled: true,
    metrics: ['queryTime', 'poolSize', 'waitingCount'],
    alertThresholds: {
      queryTimeMs: 1000,
      poolUtilization: 0.8,
      errorRate: 0.05
    }
  }
};

/**
 * Creates and configures a PostgreSQL connection pool
 */
const createDatabasePool = (connectionString: string, poolConfig: PoolConfig): Pool => {
  const pool = new Pool({
    connectionString,
    ...DATABASE_CONFIG.pool,
    ...poolConfig,
    ssl: DATABASE_CONFIG.ssl
  });

  pool.on('connect', (client) => {
    client.query('SET statement_timeout TO $1', [DATABASE_CONFIG.pool.statement_timeout]);
    client.query('SET idle_in_transaction_session_timeout TO $1', [DATABASE_CONFIG.pool.idleTimeoutMillis]);
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
};

/**
 * Database manager class for handling connections and queries
 */
class DatabaseManager {
  private primaryPool: Pool;
  private replicaPools: Pool[] = [];
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;
  private metricsCollector: MetricsCollector;
  private currentReplicaIndex: number = 0;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      redact: DATABASE_CONFIG.security.queryLogging.sensitiveParams
    });

    this.metricsCollector = {
      queryTime: [],
      poolSize: 0,
      waitingCount: 0,
      errorRate: 0
    };

    this.primaryPool = createDatabasePool(process.env.DATABASE_URL!, {});

    if (DATABASE_CONFIG.readReplicas.enabled) {
      for (let i = 0; i < DATABASE_CONFIG.readReplicas.count; i++) {
        const replicaPool = createDatabasePool(process.env.DATABASE_URL!, {
          application_name: `membo.ai-replica-${i}`
        });
        this.replicaPools.push(replicaPool);
      }
    }

    this.circuitBreaker = new CircuitBreaker(this.executeQueryInternal.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    if (DATABASE_CONFIG.monitoring.enabled) {
      setInterval(() => {
        this.metricsCollector.poolSize = this.primaryPool.totalCount;
        this.metricsCollector.waitingCount = this.primaryPool.waitingCount;
        
        if (this.metricsCollector.queryTime.length > 1000) {
          this.metricsCollector.queryTime = this.metricsCollector.queryTime.slice(-1000);
        }

        if (this.metricsCollector.poolSize / DATABASE_CONFIG.pool.max > DATABASE_CONFIG.monitoring.alertThresholds.poolUtilization) {
          this.logger.warn('Pool utilization threshold exceeded');
        }
      }, 5000);
    }
  }

  private getReplicaPool(): Pool {
    if (!this.replicaPools.length) {
      return this.primaryPool;
    }

    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaPools.length;
    return this.replicaPools[this.currentReplicaIndex];
  }

  private async executeQueryInternal<T>(
    query: string,
    params: any[],
    useReplica: boolean = false
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const pool = useReplica ? this.getReplicaPool() : this.primaryPool;

    try {
      const result = await pool.query<T>(query, params);
      const queryTime = Date.now() - startTime;
      
      this.metricsCollector.queryTime.push(queryTime);

      if (queryTime > DATABASE_CONFIG.monitoring.alertThresholds.queryTimeMs) {
        this.logger.warn({ query, queryTime }, 'Slow query detected');
      }

      return result;
    } catch (error) {
      this.logger.error({ error, query }, 'Query execution error');
      throw error;
    }
  }

  public async executeQuery<T>(
    query: string,
    params: any[] = [],
    useReplica: boolean = false,
    options: { timeout?: number } = {}
  ): Promise<QueryResult<T>> {
    return this.circuitBreaker.fire(query, params, useReplica);
  }

  public getMetrics(): MetricsCollector {
    return { ...this.metricsCollector };
  }

  public async shutdown(): Promise<void> {
    await this.primaryPool.end();
    await Promise.all(this.replicaPools.map(pool => pool.end()));
  }
}

/**
 * Initialize database connections and verify configuration
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    const { data: { version }, error } = await supabase
      .from('pg_version')
      .select('version')
      .single();

    if (error) {
      throw new Error('Failed to verify database version');
    }

    console.log(`Connected to PostgreSQL version ${version}`);
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

/**
 * Export singleton database manager instance
 */
export const databaseManager = new DatabaseManager();

// Prevent modifications to the database manager instance
Object.freeze(databaseManager);