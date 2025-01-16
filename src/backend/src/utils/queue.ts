import Bull, { Queue, Job, JobOptions } from 'bull'; // v4.x
import { logger } from 'winston'; // v3.x
import { redisClient } from '../config/redis';

// Queue configuration constants
const QUEUE_PREFIX = 'membo:queue:';

const QUEUE_PRIORITIES = {
  VOICE: 0,  // Highest priority
  WEB: 1,
  PDF: 2,
  KINDLE: 3,
  BATCH: 4   // Lowest priority
} as const;

const QUEUE_SLAS = {
  VOICE: 2000,    // 2 seconds
  WEB: 5000,      // 5 seconds
  PDF: 10000,     // 10 seconds
  KINDLE: 30000,  // 30 seconds
  BATCH: 300000   // 5 minutes
} as const;

const DEFAULT_JOB_OPTIONS: JobOptions = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  timeout: 60000 // 1 minute
};

interface QueueMetrics {
  processed: number;
  failed: number;
  delayed: number;
  active: number;
  waiting: number;
  averageProcessingTime: number;
  slaViolations: number;
}

interface QueueHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: QueueMetrics;
}

export class QueueManager {
  private queues: Map<string, Queue>;
  private metrics: Map<string, QueueMetrics>;
  private healthStatus: Map<string, QueueHealthStatus>;

  constructor() {
    this.queues = new Map();
    this.metrics = new Map();
    this.healthStatus = new Map();
    this.initializeHealthMonitoring();
  }

  private initializeHealthMonitoring(): void {
    setInterval(async () => {
      for (const [queueName, queue] of this.queues) {
        try {
          const metrics = await this.collectQueueMetrics(queue);
          this.metrics.set(queueName, metrics);
          
          const health: QueueHealthStatus = {
            status: this.determineQueueHealth(metrics),
            lastCheck: new Date(),
            metrics
          };
          
          this.healthStatus.set(queueName, health);
        } catch (error) {
          logger.error(`Queue health check failed for ${queueName}`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private async collectQueueMetrics(queue: Queue): Promise<QueueMetrics> {
    const [
      processed,
      failed,
      delayed,
      active,
      waiting,
      completedJobs
    ] = await Promise.all([
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getActiveCount(),
      queue.getWaitingCount(),
      queue.getCompleted()
    ]);

    const processingTimes = completedJobs.map(job => job.processedOn! - job.timestamp);
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    const slaViolations = completedJobs.filter(job => {
      const sla = QUEUE_SLAS[job.opts.priority as keyof typeof QUEUE_SLAS];
      return (job.processedOn! - job.timestamp) > sla;
    }).length;

    return {
      processed,
      failed,
      delayed,
      active,
      waiting,
      averageProcessingTime,
      slaViolations
    };
  }

  private determineQueueHealth(metrics: QueueMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.failed > metrics.processed * 0.1) return 'unhealthy';
    if (metrics.slaViolations > metrics.processed * 0.05) return 'degraded';
    if (metrics.waiting > 1000) return 'degraded';
    return 'healthy';
  }

  public async getQueue(queueName: string): Promise<Queue> {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const queue = new Bull(QUEUE_PREFIX + queueName, {
      redis: redisClient,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });

    // Set up queue event handlers
    queue.on('error', error => {
      logger.error(`Queue ${queueName} error:`, error);
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
    });

    queue.on('stalled', job => {
      logger.warn(`Job ${job.id} in queue ${queueName} stalled`);
    });

    this.queues.set(queueName, queue);
    return queue;
  }

  public async processQueue<T>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>
  ): Promise<void> {
    const queue = await this.getQueue(queueName);

    queue.process(async (job: Job<T>) => {
      const startTime = Date.now();
      try {
        const result = await processor(job);
        
        // Check SLA compliance
        const processingTime = Date.now() - startTime;
        const sla = QUEUE_SLAS[job.opts.priority as keyof typeof QUEUE_SLAS];
        
        if (processingTime > sla) {
          logger.warn(`SLA violation in queue ${queueName} for job ${job.id}. Processing time: ${processingTime}ms, SLA: ${sla}ms`);
        }

        return result;
      } catch (error) {
        logger.error(`Error processing job ${job.id} in queue ${queueName}:`, error);
        throw error;
      }
    });
  }

  public async addJob<T>(
    queueName: string,
    data: T,
    options: Partial<JobOptions> = {}
  ): Promise<Job<T>> {
    const queue = await this.getQueue(queueName);
    
    // Determine job priority based on content type
    let priority = QUEUE_PRIORITIES.BATCH;
    if (typeof data === 'object' && data !== null) {
      const contentType = (data as any).contentType;
      if (contentType in QUEUE_PRIORITIES) {
        priority = QUEUE_PRIORITIES[contentType as keyof typeof QUEUE_PRIORITIES];
      }
    }

    const jobOptions: JobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      priority
    };

    const job = await queue.add(data, jobOptions);
    
    // Monitor job progress
    job.progress(0);
    const startTime = Date.now();
    
    job.on('progress', progress => {
      const currentTime = Date.now();
      const sla = QUEUE_SLAS[priority as keyof typeof QUEUE_SLAS];
      
      if (currentTime - startTime > sla) {
        logger.warn(`Job ${job.id} in queue ${queueName} exceeding SLA`);
      }
    });

    return job;
  }

  public async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (job) {
      await job.remove();
      logger.info(`Removed job ${jobId} from queue ${queueName}`);
    }
  }

  public getQueueHealth(queueName: string): QueueHealthStatus | undefined {
    return this.healthStatus.get(queueName);
  }

  public getQueueMetrics(queueName: string): QueueMetrics | undefined {
    return this.metrics.get(queueName);
  }
}

// Export singleton instance
export const queueManager = new QueueManager();

// Utility functions
export async function createQueue(queueName: string, options: Partial<JobOptions> = {}): Promise<Queue> {
  return queueManager.getQueue(queueName);
}

export async function addJob<T>(
  queueName: string,
  data: T,
  options: Partial<JobOptions> = {}
): Promise<Job<T>> {
  return queueManager.addJob(queueName, data, options);
}

export async function removeJob(queueName: string, jobId: string): Promise<void> {
  return queueManager.removeJob(queueName, jobId);
}