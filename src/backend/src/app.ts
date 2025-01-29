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
import net from 'net';
import { WebSocketManager } from './websocket/WebSocketManager';
import routes from './api/routes';
import { logger } from './config/logger';
import winston from 'winston';
import { StudySessionHandler } from './websocket/handlers/studySessionHandler';
import { VoiceHandler } from './websocket/handlers/voiceHandler';
import { ConnectionPool } from './websocket/ConnectionPool';
import { MetricsCollector } from './core/metrics/MetricsCollector';
import { StudySessionManager } from './core/study/studySessionManager';
import { VoiceService } from './services/VoiceService';
import bodyParser from 'body-parser';
import { RedisClient } from './core/redis/RedisClient';
import { DatabaseManager } from './core/database/DatabaseManager';

// Initialize Express application
const app: Application = express();

// First: Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(compression());

// Second: Debug/logging middleware
app.use((req, res, next) => {
  console.log('Request in app.ts:', {
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    headers: req.headers
  });
  next();
});

// Third: Business logic middleware (if any)
// ... any other middleware ...

// Fourth: Routes
app.use('/api/v1', routes);

// Finally: Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({
    message: 'Internal server error',
    statusCode: 500
  });
});

// Create and configure HTTP server
const server = http.createServer(app);

// Configure server timeouts and limits
server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.maxHeadersCount = 100;
server.maxConnections = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);

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

// Initialize services
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
    
    // Only try to close server if it's running
    if (server.listening) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    process.exit(1);
  } catch (shutdownError) {
    logger.error('Error during shutdown:', shutdownError);
    process.exit(1);
  }
};

process.on('uncaughtException', handleUncaughtErrors);
process.on('unhandledRejection', (reason) => {
  handleUncaughtErrors(reason as Error);
});

// Export configured server and manager for use in server.ts
export { server, wsManager };
export default app;
