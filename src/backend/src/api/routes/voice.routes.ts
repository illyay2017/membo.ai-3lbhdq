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
import winston from 'winston';
import { VoiceService } from '../../services/VoiceService';
import { Redis } from 'ioredis';
import express from 'express';
import { validateVoiceRequest } from '../validators/voice.validator';

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

// Create the router instance
export const voiceRouter = Router();

// Initialize controller
const voiceController = new VoiceController(
    new VoiceService(winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console()]
    })),
    {
        logger: winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        }),
        redis: new Redis(process.env.REDIS_URL || 'redis://cache:6379')
    }
);

// Apply security headers
voiceRouter.use(helmet({
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

// Add body parsing middleware
voiceRouter.use(express.json());
voiceRouter.use(express.urlencoded({ extended: true }));

// Voice processing endpoint
voiceRouter.post('/process',
    rateLimit(VOICE_PROCESS_LIMIT),
    compression({ level: 6 }),
    validateVoiceRequest,
    async (req, res, next) => {
        try {
            console.log('Received request:', {
                contentType: req.headers['content-type'],
                bodyType: typeof req.body,
                body: req.body
            });

            // Add validation before processing
            if (!req.body || !req.body.studySessionId) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Missing required fields'
                });
            }

            await voiceController.processVoice(req, res);
        } catch (error) {
            console.error('Route error:', error);
            next(error);
        }
    }
);

// Voice settings endpoint
voiceRouter.get('/settings',
    async (req, res, next) => {
        try {
            await voiceController.getVoiceSettings(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Voice feature availability check with caching
voiceRouter.get('/availability',
    authenticate,
    (req, res, next) => {
        res.set('Cache-Control', 'private, max-age=300, must-revalidate');
        next();
    },
    async (req, res, next) => {
        try {
            await voiceController.checkVoiceAvailability(req, res);
        } catch (error) {
            next(error);
        }
    }
);

export default voiceRouter;
