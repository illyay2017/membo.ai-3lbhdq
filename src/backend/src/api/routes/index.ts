/**
 * @fileoverview Main router configuration combining all API routes with comprehensive
 * security middleware, performance monitoring, and efficient route organization.
 * @version 1.0.0
 */

import express, { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import compression from 'compression'; // ^1.7.4
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import { createVoiceRouter } from './voice.routes';
import { VoiceController } from '../controllers/VoiceController';
import authRouter from './auth.routes';
import cardsRouter from './cards.routes';
import configureContentRoutes from './content.routes';
import initializeStudyRoutes from './study.routes';
import usersRouter from './users.routes';
import { ContentController } from '../controllers/ContentController';
import { StudyController } from '../controllers/StudyController';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';
import { ContentService } from '../../services/ContentService';
import { VoiceService } from '../../services/VoiceService';
import { StudyService } from '../../services/StudyService';
import winston from 'winston';
import Redis from 'ioredis';
import { ContentProcessor } from '../../core/ai/contentProcessor';
import { SecurityService } from '../../services/SecurityService';
import { openai } from '../../config/openai';
import { voiceRouter } from './voice.routes';
import { databaseManager } from '../../config/database';
import { redisManager } from '../../config/redis';

// Initialize main router with strict routing
const router = Router({ strict: true, caseSensitive: true });

// Initialize dependencies for services
const redisClient = new Redis(process.env.REDIS_URL || 'redis://cache:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: true
});

// Add Redis connection logging
redisClient.on('connect', () => {
  console.log('Redis client connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis client ready');
});

redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

const contentProcessor = new ContentProcessor(openai);
const securityService = new SecurityService();

// Initialize services with dependencies
const contentService = new ContentService(
    contentProcessor,
    securityService,
    redisClient
);
const studyService = new StudyService();

// Create logger for voice service
const voiceLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()]
});

// Initialize services with dependencies
const voiceService = new VoiceService(voiceLogger, {
    maxAudioDuration: 60,
    confidenceThreshold: 0.8,
    supportedLanguages: ['en', 'es', 'fr'],
    cacheConfig: {
        ttl: 3600,
        maxSize: 1000
    },
    retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
    }
});

// Initialize controllers with their dependencies
const contentController = new ContentController(contentService);
const studyController = new StudyController(studyService);
const voiceController = new VoiceController(voiceService, {
    logger: voiceLogger,
    redis: redisClient
});

// Apply global security middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL!],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
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

// Configure CORS
router.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,
  maxAge: 600 // 10 minutes
}));

// Enable response compression
router.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Add request correlation ID
router.use((req: Request, res: Response, next: NextFunction) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Add request logging middleware before routes
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl
  });
  next();
});

// Debug logging for route registration
console.log('Registering routes...');
console.log('Available auth routes:', authRouter.stack.map(r => ({
  path: r.route?.path,
  methods: r.route?.methods
})));

// Mount API routes with versioning
router.use('/v1/auth', authRouter);
router.use('/v1/cards', cardsRouter);
router.use('/v1/content', configureContentRoutes(contentController));
router.use('/v1/study', initializeStudyRoutes(studyController));
router.use('/voice', voiceRouter);
router.use('/v1/users', usersRouter);

// Debug logging for mounted routes
console.log('All registered routes:', router.stack.map(r => ({
  path: r.regexp,
  handle: r.handle.name || 'middleware'
})));

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Simple query without parameters
    const dbResult = await databaseManager.executeQuery<{ version: string }>(
      'SELECT version() as version'
    );
    const dbStatus = dbResult.rowCount === 1;
    
    console.log('Database health check result:', dbResult.rows[0]);

    // Check Redis connection
    const redisStatus = await redisManager.ping();

    const isHealthy = dbStatus && redisStatus === 'PONG';
    
    console.log('Health check results:', { dbStatus, redisStatus });

    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'connected' : 'error',
        redis: redisStatus === 'PONG' ? 'connected' : 'error',
        api: 'running'
      }
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Add a root health check that redirects to the API health check
router.get('/', (req: Request, res: Response) => {
  res.redirect('/api/v1/health');
});

// Global error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id
  });

  const errorDetails = createErrorDetails(
    ErrorCodes.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    req.originalUrl
  );

  res.status(errorDetails.status).json(errorDetails);
});

// 404 handler
router.use((req: Request, res: Response) => {
  const errorDetails = createErrorDetails(
    ErrorCodes.NOT_FOUND,
    'The requested resource was not found',
    req.originalUrl
  );

  res.status(errorDetails.status).json(errorDetails);
});

export default router;
