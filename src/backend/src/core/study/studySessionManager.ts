/**
 * @fileoverview Core service responsible for managing study sessions, coordinating between
 * FSRS algorithm, card scheduling, and performance analysis. Implements comprehensive
 * session lifecycle management with voice mode and tier-specific features.
 * @version 1.0.0
 */

import { IStudySession } from '../../interfaces/IStudySession';
import { FSRSAlgorithm } from './FSRSAlgorithm';
import { CardScheduler } from './cardScheduler';
import { PerformanceAnalyzer } from './performanceAnalyzer';
import dayjs from 'dayjs'; // ^1.11.0

/**
 * Manages the lifecycle and state of study sessions with enhanced FSRS algorithm
 * integration and comprehensive performance tracking
 */
export class StudySessionManager {
    private readonly fsrsAlgorithm: FSRSAlgorithm;
    private readonly cardScheduler: CardScheduler;
    private readonly performanceAnalyzer: PerformanceAnalyzer;
    private readonly activeSessions: Map<string, IStudySession>;
    private readonly sessionTimeouts: Map<string, NodeJS.Timeout>;

    constructor(
        fsrsAlgorithm: FSRSAlgorithm,
        cardScheduler: CardScheduler,
        performanceAnalyzer: PerformanceAnalyzer
    ) {
        this.fsrsAlgorithm = fsrsAlgorithm;
        this.cardScheduler = cardScheduler;
        this.performanceAnalyzer = performanceAnalyzer;
        this.activeSessions = new Map();
        this.sessionTimeouts = new Map();
    }

    /**
     * Creates a new study session with comprehensive initialization and validation
     */
    public async createSession(
        userId: string,
        mode: string,
        settings: object
    ): Promise<IStudySession> {
        // Calculate optimal batch size based on user performance
        const batchSize = await this.cardScheduler.calculateOptimalBatchSize(userId, mode);

        // Get next due cards with FSRS optimization
        const dueCards = await this.cardScheduler.getNextDueCards(userId, mode, batchSize);

        // Initialize session with enhanced tracking
        const session: IStudySession = {
            id: crypto.randomUUID(),
            userId,
            mode,
            startTime: new Date(),
            endTime: new Date(Date.now() + 3600000), // 1 hour default
            cardsStudied: [],
            voiceEnabled: mode === 'voice',
            status: 'active',
            settings,
            performance: {
                totalCards: 0,
                correctCount: 0,
                averageConfidence: 1.0,
                studyStreak: 0,
                timeSpent: 0,
                fsrsProgress: {
                    averageStability: 0,
                    averageDifficulty: 0,
                    retentionRate: 1.0,
                    intervalProgress: 0
                }
            }
        };

        // Set up session timeout
        this.setupSessionTimeout(session.id);

        // Store active session
        this.activeSessions.set(session.id, session);

        return session;
    }

    /**
     * Processes a card review with comprehensive performance tracking
     */
    public async processCardReview(
        sessionId: string,
        cardId: string,
        rating: number
    ): Promise<object> {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Invalid session ID');

        // Process review with FSRS algorithm
        const updatedCard = await this.cardScheduler.processReview(
            cardId,
            rating,
            session.voiceEnabled
        );

        // Update session performance metrics
        session.cardsStudied.push(cardId);
        session.performance.totalCards++;
        session.performance.correctCount += rating >= 3 ? 1 : 0;
        session.performance.timeSpent = dayjs().diff(session.startTime, 'second');

        // Analyze updated performance
        const enhancedPerformance = await this.performanceAnalyzer.analyzeSessionPerformance(
            session
        );

        // Update session with enhanced metrics
        session.performance = enhancedPerformance;
        this.activeSessions.set(sessionId, session);

        return {
            session,
            nextCard: await this.cardScheduler.getNextDueCards(
                session.userId,
                session.mode,
                1
            )
        };
    }

    /**
     * Pauses session with comprehensive state preservation
     */
    public async pauseSession(sessionId: string): Promise<IStudySession> {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Invalid session ID');

        // Clear session timeout
        this.clearSessionTimeout(sessionId);

        // Update session status
        session.status = 'paused';
        
        // Analyze performance before pause
        const pausePerformance = await this.performanceAnalyzer.analyzeSessionPerformance(
            session
        );
        session.performance = pausePerformance;

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Resumes session with state restoration and validation
     */
    public async resumeSession(sessionId: string): Promise<IStudySession> {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Invalid session ID');
        if (session.status !== 'paused') throw new Error('Session not paused');

        // Restore session state
        session.status = 'active';
        
        // Reset session timeout
        this.setupSessionTimeout(sessionId);

        // Update performance metrics
        const resumePerformance = await this.performanceAnalyzer.analyzeSessionPerformance(
            session
        );
        session.performance = resumePerformance;

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Completes session with comprehensive analytics
     */
    public async completeSession(sessionId: string): Promise<object> {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Invalid session ID');

        // Clear session timeout
        this.clearSessionTimeout(sessionId);

        // Generate final performance analysis
        const finalPerformance = await this.performanceAnalyzer.analyzeSessionPerformance(
            session
        );

        // Update streak analysis
        const streakAnalysis = await this.performanceAnalyzer.analyzeStudyStreak(
            session.userId
        );

        // Generate comprehensive report
        const report = await this.performanceAnalyzer.generatePerformanceReport(
            session.userId,
            session.startTime,
            new Date()
        );

        // Update and close session
        session.status = 'completed';
        session.endTime = new Date();
        session.performance = finalPerformance;

        // Clean up session
        this.activeSessions.delete(sessionId);

        return {
            session,
            streakAnalysis,
            performanceReport: report
        };
    }

    /**
     * Retrieves current session state with enhanced metrics
     */
    public async getSessionState(sessionId: string): Promise<IStudySession> {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Invalid session ID');

        // Get real-time performance analysis
        const currentPerformance = await this.performanceAnalyzer.analyzeSessionPerformance(
            session
        );
        
        session.performance = currentPerformance;
        return session;
    }

    /**
     * Sets up session timeout handler
     */
    private setupSessionTimeout(sessionId: string): void {
        // Clear existing timeout if any
        this.clearSessionTimeout(sessionId);

        // Set new timeout (1 hour)
        const timeout = setTimeout(async () => {
            await this.completeSession(sessionId);
        }, 3600000);

        this.sessionTimeouts.set(sessionId, timeout);
    }

    /**
     * Clears session timeout
     */
    private clearSessionTimeout(sessionId: string): void {
        const timeout = this.sessionTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.sessionTimeouts.delete(sessionId);
        }
    }
}