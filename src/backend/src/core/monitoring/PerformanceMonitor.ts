/**
 * @fileoverview Backend performance monitoring system for membo.ai
 * Implements server-side performance tracking with Prometheus integration
 * @version 1.0.0
 */

import { Counter, Gauge, Histogram, register, collectDefaultMetrics } from 'prom-client';
import { logger } from '../../config/logger';

type MetricName =
  | 'api_response_time'
  | 'db_query_time'
  | 'ai_processing_time'
  | 'memory_usage'
  | 'active_websockets'
  | 'queue_size'
  | 'cache_hit_ratio'
  | 'error_rate';

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private readonly logger: typeof logger;
  
  // Prometheus metrics
  private readonly responseTime: Histogram;
  private readonly dbQueryTime: Histogram;
  private readonly aiProcessingTime: Histogram;
  private readonly memoryUsage: Gauge;
  private readonly activeConnections: Gauge;
  private readonly queueSize: Gauge;
  private readonly errorRate: Counter;
  private readonly cacheHitRatio: Gauge;

  // Active spans for tracing
  private readonly activeSpans: Map<string, SpanContext> = new Map();

  constructor() {
    // Use the configured logger directly
    this.logger = logger;

    // Initialize Prometheus metrics
    this.responseTime = new Histogram({
      name: 'api_response_time_seconds',
      help: 'API response time in seconds',
      labelNames: ['endpoint', 'method'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.dbQueryTime = new Histogram({
      name: 'db_query_time_seconds',
      help: 'Database query execution time in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.aiProcessingTime = new Histogram({
      name: 'ai_processing_time_seconds',
      help: 'AI model processing time in seconds',
      labelNames: ['model', 'operation'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30]
    });

    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type']
    });

    this.activeConnections = new Gauge({
      name: 'active_websocket_connections',
      help: 'Number of active WebSocket connections'
    });

    this.queueSize = new Gauge({
      name: 'queue_size',
      help: 'Number of items in processing queues',
      labelNames: ['queue_name']
    });

    this.errorRate = new Counter({
      name: 'error_count_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code']
    });

    this.cacheHitRatio = new Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio',
      labelNames: ['cache_name']
    });

    // Start collecting default metrics
    this.startDefaultMetrics();
  }

  /**
   * Start a performance monitoring span
   */
  startSpan(name: string, metadata?: Record<string, any>): string {
    const spanId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const traceId = metadata?.traceId || spanId;

    this.activeSpans.set(spanId, {
      traceId,
      spanId,
      parentSpanId: metadata?.parentSpanId,
      startTime: process.hrtime()[0],
      metadata
    });

    return spanId;
  }

  /**
   * End a performance monitoring span
   */
  endSpan(spanId: string, additionalMetadata?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    const duration = process.hrtime()[0] - span.startTime;
    const metadata = { ...span.metadata, ...additionalMetadata };

    // Record appropriate metric based on span name
    if (span.metadata?.type === 'api_request') {
      this.responseTime.observe(
        { endpoint: metadata.endpoint, method: metadata.method },
        duration
      );
    } else if (span.metadata?.type === 'db_query') {
      this.dbQueryTime.observe(
        { query_type: metadata.queryType, table: metadata.table },
        duration
      );
    } else if (span.metadata?.type === 'ai_processing') {
      this.aiProcessingTime.observe(
        { model: metadata.model, operation: metadata.operation },
        duration
      );
    }

    this.activeSpans.delete(spanId);
    this.logSpan(span, duration, metadata);
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.memoryUsage.set({ type: 'heapUsed' }, usage.heapUsed);
    this.memoryUsage.set({ type: 'heapTotal' }, usage.heapTotal);
    this.memoryUsage.set({ type: 'rss' }, usage.rss);
  }

  /**
   * Track WebSocket connections
   */
  trackWebSocketConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Track queue size
   */
  trackQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  /**
   * Track error occurrence
   */
  trackError(type: string, code: string): void {
    this.errorRate.inc({ type, code });
  }

  /**
   * Track cache performance
   */
  trackCacheHitRatio(cacheName: string, ratio: number): void {
    this.cacheHitRatio.set({ cache_name: cacheName }, ratio);
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  private startDefaultMetrics(): void {
    // Collect memory usage every 30 seconds
    setInterval(() => this.trackMemoryUsage(), 30000);

    // Enable default Node.js metrics
    collectDefaultMetrics();
  }

  private logSpan(span: SpanContext, duration: number, metadata: Record<string, any>): void {
    // Use debug from our configured logger
    this.logger.debug('Performance span completed', {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      duration,
      ...metadata
    });
  }
}

// Export singleton instance with configured logger
export const performanceMonitor = new PerformanceMonitor();
