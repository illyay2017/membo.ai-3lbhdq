/**
 * @fileoverview Service layer for managing content operations in the membo.ai system.
 * Implements secure content capture, processing, and lifecycle management with AI integration.
 * @version 1.0.0
 */

import Bull from 'bull'; // ^4.10.0
import Redis from 'ioredis'; // ^5.0.0
import winston from 'winston'; // ^3.8.0
import { SecurityService } from './SecurityService';
import { IContent, ContentStatus } from '../interfaces/IContent';
import { Content } from '../models/Content';
import { ContentProcessor } from '../core/ai/contentProcessor';
import { sanitizeInput, validateSchema } from '../utils/validation';

// Global constants
const PROCESSING_TIMEOUT = 10000; // 10 seconds
const MAX_BATCH_SIZE = 100;
const CACHE_TTL = 3600; // 1 hour
const MAX_RETRIES = 3;

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'content-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
});

/**
 * Enhanced service class for managing content operations with security and performance features
 */
export class ContentService {
  private contentModel: Content;
  private processingQueue: Bull.Queue;
  private cacheClient: Redis;
  private securityService: SecurityService;
  private contentProcessor: ContentProcessor;

  constructor(
    processor: ContentProcessor,
    cache: Redis
  ) {
    this.contentModel = new Content();
    this.contentProcessor = processor;
    this.cacheClient = cache;
    this.securityService = new SecurityService();
    this.initializeQueue();
  }

  /**
   * Initializes the processing queue with retry and monitoring
   */
  private initializeQueue(): void {
    this.processingQueue = new Bull('content-processing', {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        timeout: PROCESSING_TIMEOUT
      }
    });

    this.processingQueue.on('failed', (job, error) => {
      logger.error('Content processing failed', {
        jobId: job.id,
        contentId: job.data.contentId,
        error: error.message
      });
    });
  }

  /**
   * Captures and stores new content with enhanced security and validation
   * @param contentData Content data to be captured
   * @param userId User ID for authorization
   * @returns Created content item
   */
  public async captureContent(
    contentData: Omit<IContent, 'id' | 'createdAt' | 'updatedAt' | 'processedAt'>,
    userId: string
  ): Promise<IContent> {
    try {
      // Validate user authorization
      await this.securityService.validateUserAccess(userId);

      // Validate content data
      const validationResult = validateSchema(contentData, {
        content: 'required|string',
        metadata: 'required|object',
        source: 'required|string'
      });

      if (!validationResult.isValid) {
        throw new Error(`Content validation failed: ${validationResult.errors[0]?.message}`);
      }

      // Sanitize content
      const sanitizedContent = sanitizeInput(contentData.content, {
        stripTags: true,
        escapeHTML: true,
        preventSQLInjection: true
      });

      // Check cache for duplicate content
      const contentHash = await this.securityService.hashContent(sanitizedContent);
      const cacheKey = `content:${userId}:${contentHash}`;
      const cachedContent = await this.cacheClient.get(cacheKey);

      if (cachedContent) {
        logger.warn('Duplicate content detected', { userId, contentHash });
        return JSON.parse(cachedContent);
      }

      // Create content record
      const content = await this.contentModel.create({
        ...contentData,
        content: sanitizedContent,
        userId,
        status: ContentStatus.NEW
      });

      // Queue for processing
      await this.processingQueue.add(
        'process-content',
        { contentId: content.id, userId },
        {
          priority: 1,
          removeOnComplete: true
        }
      );

      // Cache the content
      await this.cacheClient.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(content)
      );

      logger.info('Content captured successfully', {
        contentId: content.id,
        userId,
        source: content.source
      });

      return content;
    } catch (error) {
      logger.error('Content capture failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves content by ID with security checks
   * @param contentId Content ID
   * @param userId User ID for authorization
   * @returns Content item if found and authorized
   */
  public async getContent(contentId: string, userId: string): Promise<IContent> {
    try {
      await this.securityService.validateUserAccess(userId);
      const content = await this.contentModel.findById(contentId, userId);

      if (!content) {
        throw new Error('Content not found');
      }

      return content;
    } catch (error) {
      logger.error('Content retrieval failed', {
        contentId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Updates content status with audit logging
   * @param contentId Content ID
   * @param userId User ID for authorization
   * @param status New content status
   * @returns Updated content item
   */
  public async updateContentStatus(
    contentId: string,
    userId: string,
    status: ContentStatus
  ): Promise<IContent> {
    try {
      await this.securityService.validateUserAccess(userId);
      return await this.contentModel.updateStatus(contentId, userId, status);
    } catch (error) {
      logger.error('Status update failed', {
        contentId,
        userId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Archives content with security validation
   * @param contentId Content ID
   * @param userId User ID for authorization
   * @returns Archived content item
   */
  public async archiveContent(contentId: string, userId: string): Promise<IContent> {
    try {
      await this.securityService.validateUserAccess(userId);
      return await this.contentModel.archive(contentId, userId);
    } catch (error) {
      logger.error('Content archival failed', {
        contentId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deletes content with security checks
   * @param contentId Content ID
   * @param userId User ID for authorization
   * @returns Success status
   */
  public async deleteContent(contentId: string, userId: string): Promise<boolean> {
    try {
      await this.securityService.validateUserAccess(userId);
      return await this.contentModel.delete(contentId, userId);
    } catch (error) {
      logger.error('Content deletion failed', {
        contentId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves user's content with optional status filter
   * @param userId User ID
   * @param status Optional status filter
   * @returns Array of content items
   */
  public async getUserContent(
    userId: string,
    status?: ContentStatus
  ): Promise<IContent[]> {
    try {
      await this.securityService.validateUserAccess(userId);
      return await this.contentModel.findByUserId(userId, status);
    } catch (error) {
      logger.error('Content retrieval failed', {
        userId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  // Add processing status tracking
  public async getProcessingStatus(contentId: string, userId: string): Promise<ProcessingStatus> {
    const status = await this.cacheClient.get(`processing:${contentId}`);
    if (!status) {
      const content = await this.contentModel.findById(contentId, userId);
      return content?.status || 'unknown';
    }
    return status;
  }

  // Add batch processing support
  public async processBatchContent(items: ContentItem[], userId: string): Promise<ProcessedContent[]> {
    const jobs = items.map(item => this.processingQueue.add('content-processing', {
      contentId: item.id,
      userId
    }));
    
    return Promise.all(jobs);
  }
}
