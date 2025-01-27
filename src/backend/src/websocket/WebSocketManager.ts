/**
 * @fileoverview Core WebSocket manager for handling real-time communication in the membo.ai learning system.
 * Implements connection pooling, enhanced security, and comprehensive monitoring.
 * @version 1.0.0
 */

import WebSocket from 'ws'; // ^8.x
import winston from 'winston'; // ^3.10.0
import http from 'http';
import { StudySessionHandler } from './handlers/studySessionHandler';
import { VoiceHandler } from './handlers/voiceHandler';

// WebSocket event constants
export const WS_EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    PING: 'ping',
    PONG: 'pong',
    VOICE_START: 'voice_start',
    VOICE_DATA: 'voice_data',
    VOICE_END: 'voice_end',
    SESSION_START: 'session_start',
    SESSION_END: 'session_end'
} as const;

// WebSocket configuration
export const WS_CONFIG = {
    PING_INTERVAL: 30000,
    PING_TIMEOUT: 5000,
    CLOSE_TIMEOUT: 10000,
    MAX_CONNECTIONS: 10000,
    RATE_LIMIT: 100,
    POOL_SIZE: 1000,
    ERROR_THRESHOLD: 50
} as const;

/**
 * Interface for connection pool management
 */
interface ConnectionPool {
    acquire(): WebSocket | null;
    release(ws: WebSocket): void;
    size(): number;
}

/**
 * Interface for metrics collection
 */
interface MetricsCollector {
    recordLatency(type: string, value: number): void;
    incrementCounter(name: string): void;
    recordGauge(name: string, value: number): void;
}

/**
 * Interface for circuit breaker
 */
interface CircuitBreaker {
    isOpen(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    reset(): void;
}

/**
 * Core WebSocket manager with enhanced performance monitoring and security
 */
export class WebSocketManager {
    private readonly wss: WebSocket.Server;
    private readonly studySessionHandler: StudySessionHandler;
    private readonly voiceHandler: VoiceHandler;
    private readonly logger: winston.Logger;
    private readonly activeConnections: Map<string, WebSocket>;
    private readonly connectionPool: ConnectionPool;
    private metrics: MetricsCollector;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly rateLimiter: Map<string, number>;

    constructor(
        server: http.Server,
        studySessionHandler: StudySessionHandler,
        voiceHandler: VoiceHandler,
        connectionPool: ConnectionPool,
        metrics: MetricsCollector,
        private readonly logger: winston.Logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'WebSocketManager' },
            transports: [
                new winston.transports.Console()
            ]
        })
    ) {
        this.wss = new WebSocket.Server({
            server,
            perMessageDeflate: true,
            maxPayload: 5 * 1024 * 1024, // 5MB max payload
            clientTracking: true
        });

        this.studySessionHandler = studySessionHandler;
        this.voiceHandler = voiceHandler;
        this.activeConnections = new Map();
        this.connectionPool = connectionPool;
        this.rateLimiter = new Map();
        
        this.circuitBreaker = {
            isOpen: () => false,
            recordSuccess: () => {},
            recordFailure: () => {},
            reset: () => {}
        };

        this.initialize();
        this.initializeMetrics();
    }

    /**
     * Initializes WebSocket server with enhanced monitoring and security
     */
    private initialize(): void {
        this.wss.on(WS_EVENTS.CONNECTION, async (ws: WebSocket, request: http.IncomingMessage) => {
            try {
                await this.handleConnection(ws, request);
            } catch (error) {
                this.logger.error('Connection initialization failed', { error });
                ws.close(1011, 'Internal server error');
            }
        });

        // Set up heartbeat monitoring
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if ((ws as any).isAlive === false) {
                    return ws.terminate();
                }
                (ws as any).isAlive = false;
                ws.ping();
            });
        }, WS_CONFIG.PING_INTERVAL);

        // Monitor active connections
        setInterval(() => {
            this.metrics.recordGauge('ws_active_connections', this.activeConnections.size);
            this.metrics.recordGauge('ws_pool_size', this.connectionPool.size());
        }, 60000);
    }

    /**
     * Handles new WebSocket connections with enhanced security and monitoring
     */
    private async handleConnection(
        ws: WebSocket,
        request: http.IncomingMessage
    ): Promise<void> {
        const startTime = Date.now();
        const clientId = request.headers['x-client-id'] as string;

        try {
            // Validate circuit breaker
            if (this.circuitBreaker.isOpen()) {
                throw new Error('Circuit breaker is open');
            }

            // Check rate limits
            if (!this.checkRateLimit(clientId)) {
                throw new Error('Rate limit exceeded');
            }

            // Extract session type and user ID from request
            const sessionType = request.headers['x-session-type'] as string;
            const userId = request.headers['x-user-id'] as string;

            if (!sessionType || !userId) {
                throw new Error('Missing required headers');
            }

            // Initialize WebSocket connection
            ws.on('pong', () => {
                (ws as any).isAlive = true;
            });

            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });

            ws.on('error', (error) => {
                this.logger.error('WebSocket error', { clientId, error });
                this.circuitBreaker.recordFailure();
            });

            // Route to appropriate handler
            if (sessionType === 'study') {
                await this.studySessionHandler.handleConnection(
                    ws,
                    userId,
                    { mode: request.headers['x-study-mode'], settings: {} }
                );
            } else if (sessionType === 'voice') {
                await this.voiceHandler.handleVoiceConnection(
                    ws,
                    userId,
                    {
                        language: request.headers['x-language'] as string,
                        confidenceThreshold: 0.7,
                        useNativeSpeaker: true
                    }
                );
            }

            // Add to active connections
            this.activeConnections.set(clientId, ws);

            // Record metrics
            this.metrics.recordLatency('ws_connection_setup', Date.now() - startTime);
            this.metrics.incrementCounter('ws_connections_total');
            this.circuitBreaker.recordSuccess();

            this.logger.info('WebSocket connection established', {
                clientId,
                sessionType,
                setupTime: Date.now() - startTime
            });

        } catch (error) {
            this.logger.error('Connection handling failed', {
                clientId,
                error,
                duration: Date.now() - startTime
            });

            ws.close(1011, error.message);
            this.circuitBreaker.recordFailure();
        }
    }

    /**
     * Handles WebSocket disconnection with comprehensive cleanup
     */
    private handleDisconnect(clientId: string): void {
        const ws = this.activeConnections.get(clientId);
        if (ws) {
            this.activeConnections.delete(clientId);
            this.connectionPool.release(ws);
            this.metrics.incrementCounter('ws_disconnections_total');
            
            this.logger.info('WebSocket connection closed', { clientId });
        }
    }

    /**
     * Checks rate limiting for client connections
     */
    private checkRateLimit(clientId: string): boolean {
        const now = Date.now();
        const requestCount = this.rateLimiter.get(clientId) || 0;

        if (requestCount >= WS_CONFIG.RATE_LIMIT) {
            return false;
        }

        this.rateLimiter.set(clientId, requestCount + 1);
        setTimeout(() => this.rateLimiter.delete(clientId), 60000);

        return true;
    }

    /**
     * Cleanup resources and close connections
     */
    public async cleanup(): Promise<void> {
        try {
            // Close all active connections
            for (const [clientId, ws] of this.activeConnections) {
                ws.close(1000, 'Server shutting down');
                this.handleDisconnect(clientId);
            }

            // Close the WebSocket server
            await new Promise<void>((resolve, reject) => {
                this.wss.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            this.logger.info('WebSocket manager cleaned up successfully');
        } catch (error) {
            this.logger.error('Error during WebSocket cleanup', { error });
            throw error;
        }
    }

    private initializeMetrics(): void {
        this.metrics = {
            recordGauge: (name: string, value: number) => {
                this.logger.debug(`Metric ${name}: ${value}`);
            },
            incrementCounter: (name: string) => {
                this.logger.debug(`Increment counter ${name}`);
            },
            recordLatency: (name: string, value: number) => {
                this.logger.debug(`Latency ${name}: ${value}ms`);
            }
        };
    }
}
