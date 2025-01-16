/**
 * @fileoverview Voice processing routes configuration for membo.ai learning system
 * Implements secure, performant voice endpoints with enhanced caching and validation
 * @version 1.0.0
 */

import { Router } from 'express';
import { VoiceController } from '../controllers/VoiceController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { createValidationMiddleware } from '../middlewares/validation.middleware';
import { voiceSettingsSchema, voiceInputSchema } from '../validators/voice.validator';
import { UserRole } from '../../constants/userRoles';
import rateLimit from 'express-rate-limit'; // ^6.9.0
import compression from 'compression'; // ^1.7.4
import helmet from 'helmet'; // ^7.0.0
import cacheControl from 'express-cache-controller'; // ^1.1.0

// Rate limiting configurations
const VOICE_PROCESS_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for voice processing
    message: 'Too many voice processing requests, please try again later'
};

const VOICE_SETTINGS_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute for settings updates
    message: 'Too many settings update requests, please try again later'
};

/**
 * Creates and configures voice processing routes with comprehensive security
 * and performance optimizations
 * @param voiceController - Initialized voice controller instance
 * @returns Configured Express router for voice endpoints
 */
export const createVoiceRouter = (voiceController: VoiceController): Router => {
    const router = Router();

    // Apply security headers
    router.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                mediaSrc: ["'self'", "blob:"],
                scriptSrc: ["'self'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: { policy: "same-origin" },
        crossOriginResourcePolicy: { policy: "same-origin" },
        dnsPrefetchControl: { allow: false },
        frameguard: { action: "deny" },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        ieNoOpen: true,
        noSniff: true,
        permittedCrossDomainPolicies: { permittedPolicies: "none" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xssFilter: true
    }));

    // Voice processing endpoint with enhanced security and performance
    router.post('/process',
        authenticate,
        authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
        rateLimit(VOICE_PROCESS_LIMIT),
        compression({ level: 6 }),
        createValidationMiddleware(voiceInputSchema, {
            stripUnknown: true,
            abortEarly: false,
            sanitize: true,
            enableCache: true,
            validationTimeout: 3000,
            securityLogging: true
        }),
        async (req, res, next) => {
            try {
                await voiceController.processVoiceInput(req, res);
            } catch (error) {
                next(error);
            }
        }
    );

    // Voice settings update endpoint with validation and rate limiting
    router.put('/settings',
        authenticate,
        authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
        rateLimit(VOICE_SETTINGS_LIMIT),
        createValidationMiddleware(voiceSettingsSchema, {
            stripUnknown: true,
            abortEarly: false,
            sanitize: true,
            enableCache: true
        }),
        async (req, res, next) => {
            try {
                await voiceController.updateVoiceSettings(req, res);
            } catch (error) {
                next(error);
            }
        }
    );

    // Voice feature availability check with caching
    router.get('/availability',
        authenticate,
        cacheControl({
            maxAge: 300, // 5 minutes cache
            private: true,
            noStore: false,
            noCache: false,
            mustRevalidate: true
        }),
        async (req, res, next) => {
            try {
                await voiceController.checkVoiceAvailability(req, res);
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
};

export default createVoiceRouter;