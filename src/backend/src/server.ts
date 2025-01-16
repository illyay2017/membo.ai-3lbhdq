/**
 * @fileoverview Main server entry point for membo.ai backend service.
 * Implements high-availability features, graceful shutdown, and comprehensive monitoring.
 * @version 1.0.0
 */

import http from 'http';
import cluster from 'cluster';
import { cpus } from 'os';
import app from './app';
import { logger } from './config/logger';
import { WebSocketManager } from './websocket/WebSocketManager';
import { StudySessionHandler } from './websocket/handlers/studySessionHandler';
import { VoiceHandler } from './websocket/handlers/voiceHandler';
import { StudySessionManager } from './core/study/studySessionManager';
import { VoiceService } from './services/VoiceService';

// Environment variables with defaults
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10);
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);

/**
 * Initializes and starts the HTTP server with WebSocket support
 */
const startServer = async (): Promise<http.Server> => {
    // Initialize HTTP server with Express app
    const server = http.createServer(app);

    // Configure server timeouts and limits
    server.timeout = 30000;
    server.keepAliveTimeout = 65000;
    server.maxHeadersCount = 100;
    server.maxConnections = MAX_CONNECTIONS;

    // Initialize WebSocket handlers
    const studySessionManager = new StudySessionManager(
        logger.child({ service: 'StudySessionManager' })
    );

    const voiceService = new VoiceService(
        logger.child({ service: 'VoiceService' }),
        {
            maxAudioDuration: 30,
            confidenceThreshold: 0.7,
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
            cacheConfig: { ttl: 3600, maxSize: 1000 },
            retryConfig: { maxAttempts: 3, backoffMs: 1000 }
        }
    );

    const studySessionHandler = new StudySessionHandler(
        studySessionManager,
        logger.child({ service: 'StudySessionHandler' })
    );

    const voiceHandler = new VoiceHandler(
        voiceService,
        logger.child({ service: 'VoiceHandler' }),
        null // Metrics collector will be injected
    );

    // Initialize WebSocket manager
    new WebSocketManager(
        server,
        studySessionHandler,
        voiceHandler,
        logger.child({ service: 'WebSocketManager' }),
        null, // Connection pool will be injected
        null  // Metrics collector will be injected
    );

    // Start listening
    server.listen(PORT, () => {
        logger.info(`Server started on port ${PORT} in ${NODE_ENV} mode`, {
            port: PORT,
            environment: NODE_ENV,
            pid: process.pid
        });
    });

    return server;
};

/**
 * Handles graceful server shutdown
 */
const gracefulShutdown = async (server: http.Server): Promise<void> => {
    logger.info('Initiating graceful shutdown...');

    // Stop accepting new connections
    server.close(async (error) => {
        if (error) {
            logger.error('Error during server close:', error);
            process.exit(1);
        }

        try {
            // Allow existing requests to complete
            await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));
            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (shutdownError) {
            logger.error('Error during shutdown:', shutdownError);
            process.exit(1);
        }
    });
};

/**
 * Sets up process handlers for graceful shutdown and error handling
 */
const setupProcessHandlers = (server: http.Server): void => {
    // Handle graceful shutdown signals
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        gracefulShutdown(server);
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection:', reason);
        gracefulShutdown(server);
    });
};

// Start server based on environment
if (NODE_ENV === 'production' && cluster.isPrimary) {
    // Fork workers in production
    const numCPUs = cpus().length;
    logger.info(`Primary ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    // Start single instance for development or worker
    startServer()
        .then(server => {
            setupProcessHandlers(server);
        })
        .catch(error => {
            logger.error('Failed to start server:', error);
            process.exit(1);
        });
}

export default app;