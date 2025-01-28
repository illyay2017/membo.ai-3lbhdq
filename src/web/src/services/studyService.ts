/**
 * @fileoverview Study service implementation for membo.ai web application
 * Implements comprehensive study session management, FSRS algorithm,
 * and voice-enabled study capabilities with enhanced performance tracking
 * @version 1.0.0
 */

import { StudySession, StudyPerformance, FSRSProgress, StudySessionSettings } from '../types/study';
import { api } from '../lib/api';
import { WebSocketManager, WS_EVENTS } from '../lib/websocket';
import { voiceService } from './voiceService';
import { Card } from '../types/card';
import { STUDY_MODES, FSRS_CONFIG, CONFIDENCE_LEVELS } from '../constants/study';

/**
 * Default study session settings with optimized parameters
 */
const DEFAULT_STUDY_SETTINGS: StudySessionSettings = {
    sessionDuration: 1800, // 30 minutes
    cardsPerSession: 20,
    showConfidenceButtons: true,
    enableFSRS: true,
    voiceEnabled: false,
    voiceConfidenceThreshold: 0.85,
    voiceLanguage: 'en-US',
    fsrsParameters: {
        stabilityThreshold: 0.7,
        difficultyThreshold: 0.8,
        retentionTarget: 0.85,
        learningRate: 0.1
    }
};

/**
 * StudyService class implementing comprehensive study session management
 */
export class StudyService {
    private wsManager: WebSocketManager | null = null;
    private voiceService: typeof voiceService;
    private currentSession: StudySession | null = null;
    private performanceMetrics: Map<string, StudyPerformance> = new Map();
    private offlineSupport: boolean = true;
    private retryAttempts: number = 3;

    constructor() {
        this.voiceService = voiceService;
    }

    /**
     * Starts a new study session with comprehensive setup
     * @param settings Optional study session settings
     * @returns Promise resolving to initialized study session
     */
    public async startStudySession(
        settings?: Partial<StudySessionSettings>
    ): Promise<StudySession> {
        try {
            const mergedSettings = { ...DEFAULT_STUDY_SETTINGS, ...settings };
            
            // Initialize session with API
            const response = await api.post<StudySession>('/api/v1/study/session', {
                settings: mergedSettings,
                mode: mergedSettings.voiceEnabled ? STUDY_MODES.VOICE : STUDY_MODES.STANDARD
            });

            this.currentSession = response;

            // Initialize voice service if enabled
            if (mergedSettings.voiceEnabled) {
                await this.voiceService.initializeVoiceService({
                    language: mergedSettings.voiceLanguage,
                    confidenceThreshold: mergedSettings.voiceConfidenceThreshold
                });
                await this.voiceService.startVoiceStudySession(response.id);
            }

            // Setup WebSocket connection for real-time updates
            await this.initializeWebSocket(response.authToken);

            return response;
        } catch (error) {
            console.error('Failed to start study session:', error);
            throw new Error('Failed to initialize study session');
        }
    }

    /**
     * Ends current study session with comprehensive cleanup
     * @returns Promise resolving to completed session data
     */
    public async endStudySession(): Promise<StudySession> {
        if (!this.currentSession) {
            throw new Error('No active study session');
        }

        try {
            // Stop voice service if active
            if (this.currentSession.settings.voiceEnabled) {
                await this.voiceService.stopVoiceStudySession();
            }

            // Calculate final performance metrics
            const finalMetrics = await this.calculateSessionMetrics();

            // Update session with API
            const response = await api.put<StudySession>(
                `/api/v1/study/session/${this.currentSession.id}`,
                {
                    status: 'completed',
                    performance: finalMetrics
                }
            );

            // Notify WebSocket of session end
            await this.wsManager?.send(WS_EVENTS.STUDY_UPDATE, {
                type: 'SESSION_END',
                sessionId: this.currentSession.id,
                metrics: finalMetrics
            });

            this.currentSession = null;
            return response;
        } catch (error) {
            console.error('Failed to end study session:', error);
            throw new Error('Failed to complete study session');
        }
    }

    /**
     * Submits a card review with FSRS algorithm processing
     * @param cardId ID of reviewed card
     * @param confidence User confidence level
     * @param voiceData Optional voice recognition data
     */
    public async submitCardReview(
        cardId: string,
        confidence: CONFIDENCE_LEVELS,
        voiceData?: { transcript: string; confidence: number }
    ): Promise<void> {
        if (!this.currentSession) {
            throw new Error('No active study session');
        }

        try {
            const reviewData = {
                sessionId: this.currentSession.id,
                cardId,
                confidence,
                timestamp: Date.now(),
                voiceData
            };

            // Process review with FSRS algorithm
            const fsrsProgress = await this.calculateFSRSProgress(cardId, confidence);

            // Update card and session data
            await api.post('/api/v1/study/review', {
                ...reviewData,
                fsrsProgress
            });

            // Send real-time update
            await this.wsManager?.send(WS_EVENTS.STUDY_UPDATE, {
                type: 'CARD_REVIEW',
                ...reviewData,
                fsrsProgress
            });

            // Update local performance metrics
            await this.updatePerformanceMetrics(cardId, confidence);
        } catch (error) {
            console.error('Failed to submit card review:', error);
            throw new Error('Failed to process card review');
        }
    }

    /**
     * Retrieves next card based on FSRS algorithm
     * @returns Promise resolving to next card
     */
    public async getNextCard(): Promise<Card> {
        if (!this.currentSession) {
            throw new Error('No active study session');
        }

        try {
            const response = await api.get<Card>('/api/v1/study/next-card', {
                params: {
                    sessionId: this.currentSession.id,
                    mode: this.currentSession.mode
                }
            });

            return response;
        } catch (error) {
            console.error('Failed to get next card:', error);
            throw new Error('Failed to retrieve next card');
        }
    }

    /**
     * Calculates FSRS algorithm progress for a card
     * @param cardId ID of card to calculate
     * @param confidence User confidence level
     * @returns Promise resolving to FSRS progress data
     */
    private async calculateFSRSProgress(
        cardId: string,
        confidence: CONFIDENCE_LEVELS
    ): Promise<FSRSProgress> {
        const card = await api.get<Card>(`/api/v1/cards/${cardId}`);
        const fsrsData = card.fsrsData;

        // Apply FSRS algorithm calculations
        const stabilityMultiplier = FSRS_CONFIG.stabilityMatrix[
            CONFIDENCE_LEVELS[confidence].toLowerCase()
        ];
        const difficultyMultiplier = FSRS_CONFIG.difficultyMatrix[
            CONFIDENCE_LEVELS[confidence].toLowerCase()
        ];

        return {
            averageStability: fsrsData.stability * stabilityMultiplier,
            averageDifficulty: fsrsData.difficulty * difficultyMultiplier,
            retentionRate: this.calculateRetentionRate(fsrsData.performanceHistory),
            stabilityGrowthRate: stabilityMultiplier,
            difficultyGrowthRate: difficultyMultiplier
        };
    }

    /**
     * Updates performance metrics for the current session
     * @param cardId ID of reviewed card
     * @param confidence User confidence level
     */
    private async updatePerformanceMetrics(
        cardId: string,
        confidence: CONFIDENCE_LEVELS
    ): Promise<void> {
        if (!this.currentSession) return;

        const currentMetrics = this.performanceMetrics.get(this.currentSession.id) || {
            totalCards: 0,
            correctCount: 0,
            incorrectCount: 0,
            averageConfidence: 0,
            studyStreak: 0,
            timeSpent: 0,
            fsrsProgress: {
                averageStability: 0,
                averageDifficulty: 0,
                retentionRate: 0,
                stabilityGrowthRate: 0,
                difficultyGrowthRate: 0
            },
            retentionRate: 0
        };

        // Update metrics based on confidence
        currentMetrics.totalCards++;
        if (confidence >= CONFIDENCE_LEVELS.GOOD) {
            currentMetrics.correctCount++;
        } else {
            currentMetrics.incorrectCount++;
        }

        currentMetrics.averageConfidence = (
            (currentMetrics.averageConfidence * (currentMetrics.totalCards - 1) + confidence) /
            currentMetrics.totalCards
        );

        this.performanceMetrics.set(this.currentSession.id, currentMetrics);
    }

    /**
     * Initialize WebSocket connection with auth token
     */
    private async initializeWebSocket(authToken: string): Promise<void> {
        try {
            if (!this.wsManager && authToken) {
                this.wsManager = new WebSocketManager(authToken);
                await this.wsManager.connect();

                this.wsManager.on(WS_EVENTS.STUDY_UPDATE, (data) => {
                    if (this.currentSession) {
                        this.handleStudyUpdate(data);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.offlineSupport = true;
        }
    }

    /**
     * Handles incoming study update events
     * @param data Update event data
     */
    private handleStudyUpdate(data: any): void {
        switch (data.type) {
            case 'PERFORMANCE_UPDATE':
                this.updatePerformanceMetrics(data.cardId, data.confidence);
                break;
            case 'SESSION_SYNC':
                this.syncSessionData(data.session);
                break;
            default:
                console.warn('Unknown study update type:', data.type);
        }
    }

    /**
     * Calculates retention rate from performance history
     * @param history Array of review history items
     */
    private calculateRetentionRate(history: any[]): number {
        if (!history.length) return 0;
        const correctReviews = history.filter(
            review => review.rating >= CONFIDENCE_LEVELS.GOOD
        ).length;
        return correctReviews / history.length;
    }

    /**
     * Synchronizes session data with server
     * @param sessionData Updated session data
     */
    private syncSessionData(sessionData: StudySession): void {
        if (this.currentSession?.id === sessionData.id) {
            this.currentSession = sessionData;
        }
    }

    /**
     * Calculates comprehensive session metrics
     */
    private async calculateSessionMetrics(): Promise<StudyPerformance> {
        if (!this.currentSession) {
            throw new Error('No active session');
        }

        const metrics = this.performanceMetrics.get(this.currentSession.id);
        if (!metrics) {
            throw new Error('No metrics found for session');
        }

        return {
            ...metrics,
            timeSpent: Date.now() - this.currentSession.startTime.getTime(),
            studyStreak: await this.calculateStudyStreak()
        };
    }

    /**
     * Calculates current study streak
     */
    private async calculateStudyStreak(): Promise<number> {
        try {
            const response = await api.get<{ streak: number }>('/api/v1/study/streak');
            return response.streak;
        } catch (error) {
            console.error('Failed to calculate study streak:', error);
            return 0;
        }
    }

    // Add method to update auth token
    public async updateAuthToken(token: string): Promise<void> {
        if (token) {
            await this.initializeWebSocket(token);
        }
    }
}
