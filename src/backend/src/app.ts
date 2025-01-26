/**
 * @fileoverview Main Express application configuration with comprehensive security,
 * performance optimization, and monitoring features for membo.ai backend service.
 * @version 1.0.0
 */

console.log('Current directory:', process.cwd());
console.log('Module paths:', module.paths);
console.log('Attempting to load reflect-metadata...');
import 'reflect-metadata';
console.log('Successfully loaded reflect-metadata');
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import http from 'http';
import { WebSocketManager } from './websocket/WebSocketManager';
import router from './api/routes';
import { logger } from './config/logger';
import winston from 'winston';
import { StudySessionHandler } from './websocket/handlers/studySessionHandler';
import { VoiceHandler } from './websocket/handlers/voiceHandler';
import { ConnectionPool } from './websocket/ConnectionPool';
import { MetricsCollector } from './core/metrics/MetricsCollector';
import { StudySessionManager } from './core/study/studySessionManager';
import { VoiceService } from './services/VoiceService';

// Initialize Express application
const app: Application = express();

/**
 * Configures Express middleware chain with security and performance features
 */
const configureMiddleware = (app: Application): void => {
  // Security headers with strict CSP
  app.use(helmet({
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

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Request parsing
  app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

  // Response compression
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  // Request correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Performance monitoring
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;

      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.id
      });
    });

    next();
  });
};

// Create HTTP server
const server = http.createServer(app);

// Configure middleware
configureMiddleware(app);

// Mount API routes
app.use('/api/v1', router);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id
  });

  res.status(500).json({
    status: 500,
    message: 'Internal server error',
    requestId: req.id
  });
});

// Initialize dependencies with proper configuration
const wsLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()]
});

// Initialize shared logger configuration
const serviceLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()]
});

// Initialize services with logger
const metricsCollector = new MetricsCollector();
const voiceService = new VoiceService(serviceLogger);
const studySessionManager = new StudySessionManager();
const connectionPool = new ConnectionPool(1000);

const studySessionHandler = new StudySessionHandler(studySessionManager, wsLogger);
const voiceHandler = new VoiceHandler(voiceService, wsLogger, metricsCollector);

const wsManager = new WebSocketManager(
    server,
    studySessionHandler,
    voiceHandler,
    connectionPool,
    metricsCollector,
    wsLogger
);

// Handle uncaught errors
const handleUncaughtErrors = async (error: Error): Promise<void> => {
  try {
    logger.error('Uncaught error:', {
      error: error.message,
      stack: error.stack
    });

    // Attempt graceful shutdown
    await wsManager.cleanup();
    server.close(() => {
      process.exit(1);
    });
  } catch (shutdownError) {
    logger.error('Error during shutdown:', shutdownError);
    process.exit(1);
  }
};

process.on('uncaughtException', handleUncaughtErrors);
process.on('unhandledRejection', (reason) => {
  handleUncaughtErrors(reason as Error);
});

// Start server with better error handling
const startServer = async (port: number, retries = 3): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => {
        logger.info(`Server started on port ${port} in ${process.env.NODE_ENV} mode`);
        resolve();
      }).on('error', async (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          if (retries > 0) {
            logger.warn(`Port ${port} is in use, trying alternative port ${port + 1}`);
            await startServer(port + 1, retries - 1);
            resolve();
          } else {
            logger.error(`No available ports found after ${retries} attempts`);
            reject(error);
          }
        } else {
          reject(error);
        }
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize server
const PORT = parseInt(process.env.PORT || '4000', 10);
startServer(PORT).catch(async (error) => {
  logger.error('Server startup failed:', error);
  try {
    await wsManager.cleanup();
  } catch (cleanupError) {
    logger.error('Cleanup failed during error handling', { error: cleanupError });
  }
  process.exit(1);
});

export default app;
