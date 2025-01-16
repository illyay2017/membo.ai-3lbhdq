/**
 * @fileoverview Voice controller implementation for membo.ai learning system
 * Handles voice-based study interactions with performance monitoring and security
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import winston from 'winston'; // ^3.10.0
import rateLimit from 'express-rate-limit'; // ^6.9.0
import { caching } from 'cache-manager'; // ^5.2.0
import { VoiceService } from '../../services/VoiceService';
import { voiceSettingsSchema, voiceInputSchema } from '../validators/voice.validator';

// Global constants
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] as const;
const CACHE_TTL = 300; // 5 minutes in seconds
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const RATE_LIMIT_MAX = 100; // Maximum requests per window

/**
 * Controller class handling voice-related HTTP endpoints with performance optimization
 */
export class VoiceController {
    private readonly cache: ReturnType<typeof caching>;
    private readonly rateLimiter: ReturnType<typeof rateLimit>;

    constructor(
        private readonly voiceService: VoiceService,
        private readonly logger: winston.Logger
    ) {
        // Initialize cache manager
        this.cache = caching({
            ttl: CACHE_TTL,
            max: 1000,
            store: 'memory'
        });

        // Configure rate limiter
        this.rateLimiter = rateLimit({
            windowMs: RATE_LIMIT_WINDOW,
            max: RATE_LIMIT_MAX,
            message: 'Too many voice processing requests',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.logger = logger.child({ controller: 'VoiceController' });
    }

    /**
     * Processes voice input for study session with performance monitoring
     */
    public processVoiceInput = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();

        try {
            // Validate request body
            const validatedInput = await voiceInputSchema.validateAsync(req.body);

            // Check cache for similar recent requests
            const cacheKey = `voice:${req.user.id}:${validatedInput.studySessionId}`;
            const cachedResult = await this.cache.get(cacheKey);

            if (cachedResult) {
                res.json(cachedResult);
                return;
            }

            // Process voice input
            const result = await this.voiceService.processStudyAnswer(
                validatedInput.studySessionId,
                Buffer.from(validatedInput.audioData, 'base64'),
                validatedInput.expectedAnswer,
                validatedInput.language
            );

            // Cache successful result
            await this.cache.set(cacheKey, result);

            // Log performance metrics
            this.logger.info('Voice input processed', {
                userId: req.user.id,
                sessionId: validatedInput.studySessionId,
                processingTime: Date.now() - startTime,
                confidence: result.confidence
            });

            res.json(result);

        } catch (error) {
            this.logger.error('Voice processing failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            res.status(400).json({
                error: 'Voice processing failed',
                message: error.message
            });
        }
    };

    /**
     * Updates user voice study settings with validation
     */
    public updateVoiceSettings = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();

        try {
            // Validate settings
            const validatedSettings = await voiceSettingsSchema.validateAsync(req.body);

            // Ensure language is supported
            if (!SUPPORTED_LANGUAGES.includes(validatedSettings.language as any)) {
                throw new Error('Unsupported language selected');
            }

            // Cache invalidation for user settings
            const cacheKey = `settings:${req.user.id}`;
            await this.cache.del(cacheKey);

            // Log performance metrics
            this.logger.info('Voice settings updated', {
                userId: req.user.id,
                duration: Date.now() - startTime,
                settings: validatedSettings
            });

            res.json({
                success: true,
                settings: validatedSettings
            });

        } catch (error) {
            this.logger.error('Voice settings update failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            res.status(400).json({
                error: 'Settings update failed',
                message: error.message
            });
        }
    };

    /**
     * Checks if voice study is available for user with caching
     */
    public checkVoiceAvailability = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();

        try {
            // Check cache for availability status
            const cacheKey = `voice:available:${req.user.id}`;
            const cachedStatus = await this.cache.get(cacheKey);

            if (cachedStatus) {
                res.json(cachedStatus);
                return;
            }

            // Check voice capability
            const availability = await this.voiceService.validateVoiceCapability(req.user.id);

            // Cache result
            await this.cache.set(cacheKey, availability);

            // Log performance metrics
            this.logger.info('Voice availability checked', {
                userId: req.user.id,
                duration: Date.now() - startTime,
                isAvailable: availability.isAvailable
            });

            res.json(availability);

        } catch (error) {
            this.logger.error('Voice availability check failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            res.status(400).json({
                error: 'Availability check failed',
                message: error.message
            });
        }
    };

    /**
     * Returns the rate limiter middleware
     */
    public getRateLimiter(): ReturnType<typeof rateLimit> {
        return this.rateLimiter;
    }
}