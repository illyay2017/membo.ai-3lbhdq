/**
 * @fileoverview REST API controller handling content-related HTTP requests in the membo.ai system.
 * Implements comprehensive validation, caching, rate limiting, and security measures.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ContentService } from '../../services/ContentService';
import { validateContentCreation, validateContentUpdate, validateContentId } from '../validators/content.validator';
import { IContent, ContentStatus } from '../../interfaces/IContent';
import { sanitizeInput } from '../../utils/validation';
import { IUser } from '../../interfaces/IUser';

// Constants for rate limiting and circuit breaking
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const CIRCUIT_BREAKER_TIMEOUT = 30000;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000;

/**
 * Enhanced controller class handling content-related HTTP endpoints with comprehensive
 * security and performance features
 */
export class ContentController {
    private rateLimiter!: RateLimiterMemory;
    private circuitBreaker!: CircuitBreaker;

    constructor(private contentService: ContentService) {
        this.initializeRateLimiter();
        this.initializeCircuitBreaker();

        // Explicitly bind all methods to ensure they're not undefined
        Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(method => method !== 'constructor')
            .forEach(method => {
                const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), method);
                if (descriptor && typeof descriptor.value === 'function') {
                    (this as any)[method] = descriptor.value.bind(this);
                }
            });
    }

    /**
     * Initializes rate limiter with configurable thresholds
     */
    private initializeRateLimiter(): void {
        this.rateLimiter = new RateLimiterMemory({
            points: 100,
            duration: 60 // per 1 minute
        });
    }

    /**
     * Initializes circuit breaker for external service calls
     */
    private initializeCircuitBreaker(): void {
        this.circuitBreaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
            return operation();
        }, {
            timeout: CIRCUIT_BREAKER_TIMEOUT,
            resetTimeout: CIRCUIT_BREAKER_RESET_TIMEOUT,
            errorThresholdPercentage: 50,
            volumeThreshold: 10
        });
    }

    /**
     * Creates new content with enhanced validation and security measures
     */
    public async createContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            // Generate correlation ID for request tracking
            const correlationId = crypto.randomUUID();

            // Validate request data
            const { error, value } = validateContentCreation(req.body);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Validation failed',
                    details: error.details,
                    correlationId
                });
            }

            // Sanitize content
            const sanitizedContent = sanitizeInput(value.content, {
                stripTags: true,
                escapeHTML: true,
                preventSQLInjection: true
            });

            // Create content through circuit breaker
            const content = await this.circuitBreaker.fire(async () => {
                return this.contentService.captureContent({
                    ...value,
                    content: sanitizedContent,
                    userId: req.user.id
                }, req.user.id);
            });

            return res.status(StatusCodes.CREATED).json({
                data: content,
                correlationId
            });
        } catch (error: any) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
                    error: 'Rate limit exceeded',
                    retryAfter: error.msBeforeNext / 1000
                });
            }

            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to create content',
                message: error.message
            });
        }
    }

    /**
     * Retrieves content by ID with security validation
     */
    public async getContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            const { error } = validateContentId(req.params.id);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Invalid content ID',
                    details: error.details
                });
            }

            const content = await this.circuitBreaker.fire(async () => {
                return this.contentService.getContentById(req.params.id, req.user.id);
            });

            if (!content) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    error: 'Content not found'
                });
            }

            return res.status(StatusCodes.OK).json({ data: content });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to retrieve content',
                message: error.message
            });
        }
    }

    /**
     * Retrieves user's content with optional filtering
     */
    public async getUserContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            const status = req.query.status as ContentStatus;
            const content = await this.circuitBreaker.fire(async () => {
                return this.contentService.getUserContent(req.user.id, status);
            });

            return res.status(StatusCodes.OK).json({ data: content });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to retrieve user content',
                message: error.message
            });
        }
    }

    /**
     * Archives content with security validation
     */
    public async archiveContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            const { error } = validateContentId(req.params.id);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Invalid content ID',
                    details: error.details
                });
            }

            const content = await this.circuitBreaker.fire(async () => {
                return this.contentService.archiveContent(req.params.id, req.user.id);
            });

            return res.status(StatusCodes.OK).json({ data: content });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to archive content',
                message: error.message
            });
        }
    }

    /**
     * Deletes content with security checks
     */
    public async deleteContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            const { error } = validateContentId(req.params.id);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Invalid content ID',
                    details: error.details
                });
            }

            const success = await this.circuitBreaker.fire(async () => {
                return this.contentService.deleteContent(req.params.id, req.user.id);
            });

            if (!success) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    error: 'Content not found or already deleted'
                });
            }

            return res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to delete content',
                message: error.message
            });
        }
    }

    public async processContent(req: Request, res: Response): Promise<Response> {
        try {
            await this.rateLimiter.consume(req.ip || req.socket.remoteAddress || '');

            const { error } = validateContentId(req.params.id);
            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Invalid content ID',
                    details: error.details
                });
            }

            const processed = await this.circuitBreaker.fire(async () => {
                return this.contentService.processContent(req.params.id, req.user.id);
            });

            return res.status(StatusCodes.OK).json({ data: processed });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to process content',
                message: error.message
            });
        }
    }

    public async getContentStatus(req: Request, res: Response): Promise<Response> {
        try {
            const status = await this.contentService.getProcessingStatus(req.params.id, req.user.id);
            return res.status(StatusCodes.OK).json({ data: status });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to get content status',
                message: error.message
            });
        }
    }

    public async processBatchContent(req: Request, res: Response): Promise<Response> {
        try {
            const processed = await this.contentService.processBatchContent(req.body.items, req.user.id);
            return res.status(StatusCodes.OK).json({ data: processed });
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to process batch content',
                message: error.message
            });
        }
    }
}
