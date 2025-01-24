/**
 * @fileoverview Voice controller implementation for membo.ai learning system
 * Handles voice-based study interactions with performance monitoring and security
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import { caching } from 'cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { VoiceService } from '../../services/VoiceService';
import { voiceSettingsSchema, voiceInputSchema } from '../validators/voice.validator';

// Constants
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] as const;
const CACHE_TTL = 300; // 5 minutes
const RATE_LIMIT = {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
} as const;

/**
 * Controller class handling voice-related HTTP endpoints with performance optimization
 */
export class VoiceController {
    private cache!: Awaited<ReturnType<typeof caching>>;
    private readonly rateLimiter: ReturnType<typeof rateLimit>;

    constructor(
        private readonly voiceService: VoiceService,
        private readonly logger: winston.Logger
    ) {
        this.initializeCache();
        this.rateLimiter = rateLimit({
            windowMs: RATE_LIMIT.WINDOW_MS,
            max: RATE_LIMIT.MAX_REQUESTS,
            message: 'Too many voice processing requests',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.logger = logger.child({ controller: 'VoiceController' });
    }

    private async initializeCache() {
        // Use Redis store with connection to docker service named 'cache'
        const keyv = new Keyv({
            store: new KeyvRedis('redis://cache:6379')
        });

        this.cache = await caching(keyv, {
            ttl: CACHE_TTL * 1000
        });
    }

    /**
     * Processes voice input for study session with performance monitoring
     */
    public processVoiceInput = async (req: Request, res: Response): Promise<Response> => {
        const startTime = Date.now();

        try {
            const validatedInput = await voiceInputSchema.validateAsync(req.body);
            const cacheKey = `voice:${req.user.id}:${validatedInput.studySessionId}`;
            
            const cachedResult = await this.cache.get(cacheKey);
            if (cachedResult) {
                return res.json(cachedResult);
            }

            const result = await this.voiceService.processStudyAnswer(
                validatedInput.studySessionId,
                Buffer.from(validatedInput.audioData, 'base64'),
                validatedInput.expectedAnswer,
                validatedInput.language
            );

            await this.cache.set(cacheKey, result);

            this.logger.info('Voice input processed', {
                userId: req.user.id,
                sessionId: validatedInput.studySessionId,
                processingTime: Date.now() - startTime,
                confidence: result.confidence
            });

            return res.json(result);
        } catch (error) {
            this.logger.error('Voice processing failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            return res.status(400).json({
                error: 'Voice processing failed',
                message: error.message
            });
        }
    };

    /**
     * Updates user voice study settings with validation
     */
    public updateVoiceSettings = async (req: Request, res: Response): Promise<Response> => {
        const startTime = Date.now();

        try {
            const validatedSettings = await voiceSettingsSchema.validateAsync(req.body);

            if (!SUPPORTED_LANGUAGES.includes(validatedSettings.language as any)) {
                throw new Error('Unsupported language selected');
            }

            await this.cache.del(`settings:${req.user.id}`);

            const updatedSettings = await this.voiceService.updateUserSettings(
                req.user.id,
                validatedSettings
            );

            this.logger.info('Voice settings updated', {
                userId: req.user.id,
                duration: Date.now() - startTime,
                settings: validatedSettings
            });

            return res.json({
                success: true,
                settings: updatedSettings
            });
        } catch (error) {
            this.logger.error('Voice settings update failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            return res.status(400).json({
                error: 'Settings update failed',
                message: error.message
            });
        }
    };

    /**
     * Checks if voice study is available for user with caching
     */
    public checkVoiceAvailability = async (req: Request, res: Response): Promise<Response> => {
        const startTime = Date.now();

        try {
            const cacheKey = `voice:available:${req.user.id}`;
            const cachedStatus = await this.cache.get(cacheKey);

            if (cachedStatus) {
                return res.json(cachedStatus);
            }

            const availability = await this.voiceService.validateVoiceCapability(req.user.id);
            await this.cache.set(cacheKey, availability);

            this.logger.info('Voice availability checked', {
                userId: req.user.id,
                duration: Date.now() - startTime,
                isAvailable: availability.isAvailable
            });

            return res.json(availability);
        } catch (error) {
            this.logger.error('Voice availability check failed', {
                error: error.message,
                userId: req.user?.id,
                duration: Date.now() - startTime
            });

            return res.status(400).json({
                error: 'Availability check failed',
                message: error.message
            });
        }
    };

    public getRateLimiter(): ReturnType<typeof rateLimit> {
        return this.rateLimiter;
    }
}
