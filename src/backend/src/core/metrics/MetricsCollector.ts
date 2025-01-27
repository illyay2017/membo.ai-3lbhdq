import { EventEmitter } from 'events';

export interface MetricValue {
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}

export interface MetricConfig {
    name: string;
    help?: string;
    labels?: string[];
}

export class MetricsCollector extends EventEmitter {
    private counters: Map<string, number>;
    private gauges: Map<string, number>;
    private histograms: Map<string, MetricValue[]>;
    private readonly retentionPeriod: number = 3600000; // 1 hour in ms

    constructor() {
        super();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();

        // Cleanup old metrics periodically
        setInterval(() => this.cleanup(), this.retentionPeriod);
    }

    /**
     * Increment a counter metric
     */
    public increment(name: string, value: number = 1, labels?: Record<string, string>): void {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
        this.emit('metric', { type: 'counter', name, value: current + value, labels });
    }

    /**
     * Set a gauge metric value
     */
    public gauge(name: string, value: number, labels?: Record<string, string>): void {
        this.gauges.set(name, value);
        this.emit('metric', { type: 'gauge', name, value, labels });
    }

    /**
     * Record a histogram value
     */
    public histogram(name: string, value: number, labels?: Record<string, string>): void {
        const values = this.histograms.get(name) || [];
        values.push({ value, timestamp: Date.now(), labels });
        this.histograms.set(name, values);
        this.emit('metric', { type: 'histogram', name, value, labels });
    }

    /**
     * Record timing in milliseconds
     */
    public recordLatency(name: string, value: number, labels?: Record<string, string>): void {
        this.histogram(`${name}_latency_ms`, value, labels);
    }

    /**
     * Get current value of a counter
     */
    public getCounter(name: string): number {
        return this.counters.get(name) || 0;
    }

    /**
     * Get current value of a gauge
     */
    public getGauge(name: string): number {
        return this.gauges.get(name) || 0;
    }

    /**
     * Get histogram values for a metric
     */
    public getHistogram(name: string): MetricValue[] {
        return this.histograms.get(name) || [];
    }

    /**
     * Calculate histogram statistics
     */
    public getHistogramStats(name: string): {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p95: number;
    } {
        const values = this.getHistogram(name).map(v => v.value);
        if (values.length === 0) {
            return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p95: 0 };
        }

        values.sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const p95Index = Math.floor(values.length * 0.95);

        return {
            count: values.length,
            sum,
            avg: sum / values.length,
            min: values[0],
            max: values[values.length - 1],
            p95: values[p95Index]
        };
    }

    /**
     * Get all metrics
     */
    public getAllMetrics(): Record<string, any> {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(this.histograms)
        };
    }

    /**
     * Reset all metrics
     */
    public reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.emit('reset');
    }

    /**
     * Clean up old histogram values
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [name, values] of this.histograms.entries()) {
            const filtered = values.filter(v => 
                now - v.timestamp < this.retentionPeriod
            );
            this.histograms.set(name, filtered);
        }
    }
}
