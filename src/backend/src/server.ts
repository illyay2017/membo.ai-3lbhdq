/**
 * @fileoverview Main server entry point for membo.ai backend service.
 * Implements high-availability features, graceful shutdown, and comprehensive monitoring.
 * @version 1.0.0
 */

import http from 'node:http';
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import app, { server, wsManager } from './app.js';
import { logger } from './config/logger.js';

// Environment variables with defaults
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10);

/**
 * Starts the server with port checking
 */
const startServer = async (port: number): Promise<void> => {
    try {
        await new Promise<void>((resolve, reject) => {
            server.listen(port, () => {
                logger.info(`Server started on port ${port} in ${NODE_ENV} mode`, {
                    port,
                    environment: NODE_ENV,
                    pid: process.pid
                });
                resolve();
            }).on('error', reject);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        throw error;
    }
};

/**
 * Handles graceful server shutdown
 */
const gracefulShutdown = async (server: http.Server): Promise<void> => {
    logger.info('Initiating graceful shutdown...');
    
    try {
        // Cleanup WebSocket connections
        await wsManager.cleanup();
        
        // Stop accepting new connections
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Allow existing requests to complete
        await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

/**
 * Sets up process handlers for graceful shutdown and error handling
 */
const setupProcessHandlers = (): void => {
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
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
    startServer(PORT)
        .then(() => {
            setupProcessHandlers();
        })
        .catch(error => {
            logger.error('Failed to start server:', error);
            process.exit(1);
        });
}

export default app;
