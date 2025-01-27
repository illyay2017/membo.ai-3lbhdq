/**
 * @fileoverview Voice controller implementation for membo.ai learning system
 * Handles voice-based study interactions with performance monitoring and security
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import { caching } from 'cache-manager';
import { VoiceService } from '../../services/VoiceService';
import { voiceSettingsSchema, voiceInputSchema } from '../validators/voice.validator';
import { Redis } from 'ioredis';
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
    private readonly logger: winston.Logger;

    constructor(
        private readonly voiceService: VoiceService,
        config: {
            logger: winston.Logger;
            redis: Redis;
        }
    ) {
        this.logger = config.logger.child({ controller: 'VoiceController' });
        
        // Initialize Redis with non-cluster config
        const redis = new Redis({
            host: 'cache',  // Docker service name
            port: 6379,
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                return Math.min(times * 50, 2000);
            }
        });

        redis.on('error', (err) => {
            this.logger.error('Redis connection error:', err);
        });

        this.initializeCache();
        this.rateLimiter = rateLimit({
            windowMs: RATE_LIMIT.WINDOW_MS,
            max: RATE_LIMIT.MAX_REQUESTS,
            message: 'Too many voice processing requests',
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    private async initializeCache(): Promise<void> {
        this.cache = await caching('memory', {
            ttl: 3600000, // 1 hour
            max: 1000
        });
    }

    /**
     * Processes voice input for study session with performance monitoring
     */
    public processVoice = async (req: Request, res: Response) => {
        try {
            const { audioData, language, studySessionId, expectedAnswer } = req.body;

            // Log the received data for debugging
            console.log('Received voice processing request:', {
                language,
                studySessionId,
                expectedAnswer,
                audioDataLength: audioData?.length
            });

            const result = await this.voiceService.processVoice(
                audioData,
                language,
                studySessionId,
                expectedAnswer
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error processing voice:', error);
            return res.status(500).json({
                error: "Processing failed",
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

    public async getVoiceSettings(req: Request, res: Response): Promise<void> {
        try {
            const settings = {
                supportedLanguages: ['en', 'es', 'fr'],
                maxAudioDuration: 60,
                confidenceThreshold: 0.8
            };
            res.json(settings);
        } catch (error) {
            this.logger.error('Failed to get voice settings:', error);
            throw error;
        }
    }
}
