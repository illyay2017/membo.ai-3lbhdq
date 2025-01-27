/**
 * Frontend performance monitoring for membo.ai web application
 * Tracks user interactions, rendering, and study session metrics
 */

type MetricName = 
  | 'cardLoadTime'
  | 'answerSubmissionTime'
  | 'voiceProcessingTime'
  | 'renderTime'
  | 'apiLatency'
  | 'studySessionDuration';

interface MetricValue {
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface PerformanceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private metrics: Map<MetricName, MetricValue[]> = new Map();
  private spans: Map<string, PerformanceSpan> = new Map();
  private readonly maxDataPoints = 1000;

  /**
   * Track a single performance metric
   */
  trackMetric(name: MetricName, value: number, tags?: Record<string, string>) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricValues = this.metrics.get(name)!;
    metricValues.push({
      value,
      timestamp: Date.now(),
      tags
    });

    // Prevent unlimited growth
    if (metricValues.length > this.maxDataPoints) {
      metricValues.shift();
    }

    // Report to analytics if configured
    this.reportMetric(name, value, tags);
  }

  /**
   * Start tracking a performance span
   */
  startSpan(name: string, metadata?: Record<string, any>): string {
    const spanId = `${name}_${Date.now()}`;
    this.spans.set(spanId, {
      name,
      startTime: performance.now(),
      metadata
    });
    return spanId;
  }

  /**
   * End a performance span and calculate duration
   */
  endSpan(spanId: string, additionalMetadata?: Record<string, any>) {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = performance.now();
    span.metadata = { ...span.metadata, ...additionalMetadata };

    const duration = span.endTime - span.startTime;
    this.trackMetric(span.name as MetricName, duration, {
      spanId,
      ...span.metadata
    });

    this.spans.delete(spanId);
    return duration;
  }

  /**
   * Get aggregated metrics for a specific metric name
   */
  getMetrics(name: MetricName) {
    const values = this.metrics.get(name) || [];
    return {
      average: this.calculateAverage(values),
      min: this.calculateMin(values),
      max: this.calculateMax(values),
      p95: this.calculatePercentile(values, 95),
      count: values.length,
      recentValue: values[values.length - 1]?.value
    };
  }

  /**
   * Clear all stored metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.spans.clear();
  }

  private calculateAverage(values: MetricValue[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v.value, 0) / values.length;
  }

  private calculateMin(values: MetricValue[]): number {
    if (values.length === 0) return 0;
    return Math.min(...values.map(v => v.value));
  }

  private calculateMax(values: MetricValue[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values.map(v => v.value));
  }

  private calculatePercentile(values: MetricValue[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a.value - b.value);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index].value;
  }

  private reportMetric(name: MetricName, value: number, tags?: Record<string, string>) {
    // Integration point for external monitoring services
    if (process.env.NODE_ENV === 'production') {
      // Example: Report to Google Analytics
      // window.gtag?.('event', 'performance_metric', {
      //   metric_name: name,
      //   value,
      //   ...tags
      // });
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
