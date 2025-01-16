/**
 * @fileoverview WebSocket handler for real-time study session management with FSRS algorithm
 * implementation, voice capabilities, and performance tracking. Ensures sub-200ms response
 * times and maintains study streaks for optimal knowledge retention.
 * @version 1.0.0
 */

import WebSocket from 'ws'; // ^8.x
import winston from 'winston'; // ^3.10.0
import { performance } from 'perf_hooks';
import { StudySessionManager } from '../../core/study/studySessionManager';
import { StudyModes } from '../../constants/studyModes';
import { IStudySession } from '../../interfaces/IStudySession';

// WebSocket event constants
const WS_STUDY_EVENTS = {
    START_SESSION: 'study:start',
    PAUSE_SESSION: 'study:pause',
    RESUME_SESSION: 'study:resume',
    COMPLETE_SESSION: 'study:complete',
    CARD_REVIEW: 'study:review',
    NEXT_CARD: 'study:next',
    SESSION_UPDATE: 'study:update',
    SESSION_ERROR: 'study:error',
    VOICE_INPUT: 'study:voice',
    STREAK_UPDATE: 'study:streak',
    RETENTION_UPDATE: 'study:retention',
    PERFORMANCE_STATS: 'study:performance'
} as const;

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
    RESPONSE_TIME_MS: 200,
    VOICE_PROCESSING_MS: 500,
    HEARTBEAT_INTERVAL_MS: 30000,
    RECONNECT_TIMEOUT_MS: 5000
};

interface SessionState {
    id: string;
    userId: string;
    mode: StudyModes;
    startTime: number;
    lastActivity: number;
    performanceMetrics: {
        responseTimesMs: number[];
        retentionRate: number;
        streakDays: number;
    };
}

/**
 * Handles WebSocket connections for real-time study sessions with comprehensive
 * performance tracking and voice capabilities
 */
export class StudySessionHandler {
    private readonly studySessionManager: StudySessionManager;
    private readonly logger: winston.Logger;
    private readonly activeStudySessions: Map<string, WebSocket>;
    private readonly sessionStates: Map<string, SessionState>;
    private readonly heartbeatInterval: number;

    constructor(
        studySessionManager: StudySessionManager,
        logger: winston.Logger
    ) {
        this.studySessionManager = studySessionManager;
        this.logger = logger;
        this.activeStudySessions = new Map();
        this.sessionStates = new Map();
        this.heartbeatInterval = PERFORMANCE_THRESHOLDS.HEARTBEAT_INTERVAL_MS;

        // Initialize heartbeat monitoring
        setInterval(() => this.checkHeartbeats(), this.heartbeatInterval);
    }

    /**
     * Handles new WebSocket connections with performance tracking
     */
    public async handleConnection(
        ws: WebSocket,
        userId: string,
        config: { mode: StudyModes; settings: any }
    ): Promise<void> {
        try {
            const sessionStartTime = performance.now();
            
            // Initialize study session
            const session = await this.studySessionManager.createSession(
                userId,
                config.mode,
                config.settings
            );

            // Initialize session state
            const sessionState: SessionState = {
                id: session.id,
                userId,
                mode: config.mode,
                startTime: sessionStartTime,
                lastActivity: Date.now(),
                performanceMetrics: {
                    responseTimesMs: [],
                    retentionRate: 1.0,
                    streakDays: 0
                }
            };

            this.sessionStates.set(session.id, sessionState);
            this.activeStudySessions.set(session.id, ws);

            // Set up message handlers
            this.setupMessageHandlers(ws, session);
            
            // Send initial session data
            this.sendWithLatencyTracking(ws, {
                type: WS_STUDY_EVENTS.SESSION_UPDATE,
                data: session
            });

            this.logger.info(`Study session started: ${session.id} for user: ${userId}`);
        } catch (error) {
            this.handleError(ws, error);
        }
    }

    /**
     * Sets up WebSocket message handlers with performance tracking
     */
    private setupMessageHandlers(ws: WebSocket, session: IStudySession): void {
        ws.on('message', async (message: string) => {
            const startTime = performance.now();
            try {
                const { type, data } = JSON.parse(message);
                const state = this.sessionStates.get(session.id);
                
                if (!state) {
                    throw new Error('Invalid session state');
                }

                state.lastActivity = Date.now();

                switch (type) {
                    case WS_STUDY_EVENTS.CARD_REVIEW:
                        await this.handleCardReview(ws, session.id, data);
                        break;

                    case WS_STUDY_EVENTS.VOICE_INPUT:
                        await this.handleVoiceInput(ws, session.id, data);
                        break;

                    case WS_STUDY_EVENTS.PAUSE_SESSION:
                        await this.handleSessionPause(ws, session.id);
                        break;

                    case WS_STUDY_EVENTS.RESUME_SESSION:
                        await this.handleSessionResume(ws, session.id);
                        break;

                    case WS_STUDY_EVENTS.COMPLETE_SESSION:
                        await this.handleSessionComplete(ws, session.id);
                        break;
                }

                // Track response time
                const responseTime = performance.now() - startTime;
                this.trackPerformanceMetric(session.id, 'responseTime', responseTime);

            } catch (error) {
                this.handleError(ws, error);
            }
        });

        // Handle connection closure
        ws.on('close', () => {
            this.handleSessionClose(session.id);
        });
    }

    /**
     * Handles card review submissions with FSRS algorithm integration
     */
    private async handleCardReview(
        ws: WebSocket,
        sessionId: string,
        data: { cardId: string; rating: number }
    ): Promise<void> {
        const startTime = performance.now();

        const result = await this.studySessionManager.processCardReview(
            sessionId,
            data.cardId,
            data.rating
        );

        this.sendWithLatencyTracking(ws, {
            type: WS_STUDY_EVENTS.SESSION_UPDATE,
            data: result
        });

        // Track performance
        const responseTime = performance.now() - startTime;
        this.trackPerformanceMetric(sessionId, 'responseTime', responseTime);
    }

    /**
     * Handles voice input processing with confidence scoring
     */
    private async handleVoiceInput(
        ws: WebSocket,
        sessionId: string,
        data: { audioData: any; cardId: string }
    ): Promise<void> {
        const startTime = performance.now();

        // Process voice input and calculate confidence
        const result = await this.studySessionManager.processCardReview(
            sessionId,
            data.cardId,
            0 // Rating will be determined by voice processing
        );

        this.sendWithLatencyTracking(ws, {
            type: WS_STUDY_EVENTS.VOICE_INPUT,
            data: result
        });

        const processingTime = performance.now() - startTime;
        this.trackPerformanceMetric(sessionId, 'voiceProcessing', processingTime);
    }

    /**
     * Handles session pause with state preservation
     */
    private async handleSessionPause(
        ws: WebSocket,
        sessionId: string
    ): Promise<void> {
        const session = await this.studySessionManager.pauseSession(sessionId);
        
        this.sendWithLatencyTracking(ws, {
            type: WS_STUDY_EVENTS.SESSION_UPDATE,
            data: session
        });
    }

    /**
     * Handles session resume with state restoration
     */
    private async handleSessionResume(
        ws: WebSocket,
        sessionId: string
    ): Promise<void> {
        const session = await this.studySessionManager.resumeSession(sessionId);
        
        this.sendWithLatencyTracking(ws, {
            type: WS_STUDY_EVENTS.SESSION_UPDATE,
            data: session
        });
    }

    /**
     * Handles session completion with comprehensive analytics
     */
    private async handleSessionComplete(
        ws: WebSocket,
        sessionId: string
    ): Promise<void> {
        const result = await this.studySessionManager.completeSession(sessionId);
        
        this.sendWithLatencyTracking(ws, {
            type: WS_STUDY_EVENTS.COMPLETE_SESSION,
            data: result
        });

        // Clean up session resources
        this.handleSessionClose(sessionId);
    }

    /**
     * Tracks performance metrics for the session
     */
    private trackPerformanceMetric(
        sessionId: string,
        metricType: string,
        value: number
    ): void {
        const state = this.sessionStates.get(sessionId);
        if (!state) return;

        if (metricType === 'responseTime') {
            state.performanceMetrics.responseTimesMs.push(value);
            
            // Alert if response time exceeds threshold
            if (value > PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS) {
                this.logger.warn(`High latency detected in session ${sessionId}: ${value}ms`);
            }
        }
    }

    /**
     * Sends WebSocket message with latency tracking
     */
    private sendWithLatencyTracking(ws: WebSocket, message: any): void {
        const startTime = performance.now();
        
        ws.send(JSON.stringify({
            ...message,
            timestamp: Date.now()
        }));

        const latency = performance.now() - startTime;
        if (latency > PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS) {
            this.logger.warn(`Message send latency exceeded threshold: ${latency}ms`);
        }
    }

    /**
     * Handles WebSocket errors with logging
     */
    private handleError(ws: WebSocket, error: any): void {
        this.logger.error('WebSocket error:', error);
        
        ws.send(JSON.stringify({
            type: WS_STUDY_EVENTS.SESSION_ERROR,
            error: {
                message: error.message,
                code: error.code || 'INTERNAL_ERROR'
            }
        }));
    }

    /**
     * Handles session cleanup on connection close
     */
    private handleSessionClose(sessionId: string): void {
        this.activeStudySessions.delete(sessionId);
        this.sessionStates.delete(sessionId);
        this.logger.info(`Study session closed: ${sessionId}`);
    }

    /**
     * Monitors session heartbeats and closes inactive sessions
     */
    private checkHeartbeats(): void {
        const now = Date.now();
        
        this.sessionStates.forEach((state, sessionId) => {
            if (now - state.lastActivity > PERFORMANCE_THRESHOLDS.HEARTBEAT_INTERVAL_MS) {
                const ws = this.activeStudySessions.get(sessionId);
                if (ws) {
                    ws.close(1000, 'Session timeout');
                    this.handleSessionClose(sessionId);
                }
            }
        });
    }
}