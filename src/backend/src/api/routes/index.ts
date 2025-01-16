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

// Initialize main router with strict routing
const router = Router({ strict: true, caseSensitive: true });

// Initialize controllers
const contentController = new ContentController();
const studyController = new StudyController();
const voiceController = new VoiceController();

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

// Mount API routes with versioning
router.use('/v1/auth', authRouter);
router.use('/v1/cards', cardsRouter);
router.use('/v1/content', configureContentRoutes(contentController));
router.use('/v1/study', initializeStudyRoutes(studyController));
router.use('/v1/voice', createVoiceRouter(voiceController));
router.use('/v1/users', usersRouter);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION
  });
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