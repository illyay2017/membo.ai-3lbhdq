/**
 * @fileoverview Enhanced study session model implementing comprehensive session management,
 * performance tracking, voice interaction, and FSRS algorithm integration for optimized learning.
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { IStudySession, IStudyPerformance } from '../interfaces/IStudySession';
import { StudyModes, StudyModeConfig } from '../constants/studyModes';
import { FSRSAlgorithm } from '../core/study/FSRSAlgorithm';

/**
 * Enum defining possible session statuses
 */
enum SessionStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    PAUSED = 'paused'
}

/**
 * Interface for voice recognition metrics
 */
interface VoiceMetrics {
    confidence: number;
    duration: number;
    language?: string;
    errorCount: number;
}

/**
 * Enhanced study session model with comprehensive performance tracking
 * and voice-enabled learning support
 */
export class StudySession implements IStudySession {
    public readonly id: string;
    public readonly userId: string;
    public readonly mode: StudyModes;
    public startTime: Date;
    public endTime: Date;
    public cardsStudied: string[];
    public performance: IStudyPerformance;
    public voiceEnabled: boolean;
    public voiceConfidence: number;
    public status: SessionStatus;
    public settings: typeof StudyModeConfig[keyof typeof StudyModeConfig];
    private fsrsAlgorithm: FSRSAlgorithm;
    private streak: number;
    private retentionRate: number;
    private pauseStartTime?: Date;

    /**
     * Creates a new study session with enhanced tracking capabilities
     */
    constructor(
        userId: string,
        mode: StudyModes,
        settings?: Partial<typeof StudyModeConfig[keyof typeof StudyModeConfig]>
    ) {
        this.id = uuidv4();
        this.userId = userId;
        this.mode = mode;
        this.startTime = new Date();
        this.cardsStudied = [];
        this.status = SessionStatus.ACTIVE;
        this.voiceEnabled = mode === StudyModes.VOICE;
        this.voiceConfidence = 0;
        this.streak = 0;
        this.retentionRate = 0;

        // Initialize settings with mode-specific defaults
        this.settings = {
            ...StudyModeConfig[mode],
            ...settings
        };

        // Initialize FSRS algorithm
        this.fsrsAlgorithm = new FSRSAlgorithm();

        // Initialize performance metrics
        this.performance = {
            totalCards: 0,
            correctCount: 0,
            averageConfidence: 0,
            studyStreak: 0,
            timeSpent: 0,
            fsrsProgress: {
                averageStability: 0,
                averageDifficulty: 0,
                retentionRate: 0,
                intervalProgress: 0
            }
        };
    }

    /**
     * Records card study results with enhanced metrics and voice support
     */
    public async recordCardStudy(
        cardId: string,
        confidence: number,
        isCorrect: boolean,
        voiceData?: VoiceMetrics
    ): Promise<void> {
        // Add card to studied list
        if (!this.cardsStudied.includes(cardId)) {
            this.cardsStudied.push(cardId);
        }

        // Update performance metrics
        this.performance.totalCards++;
        if (isCorrect) {
            this.performance.correctCount++;
        }

        // Process voice data if available
        if (this.voiceEnabled && voiceData) {
            this.processVoiceMetrics(voiceData);
        }

        // Update confidence metrics
        const currentTotal = this.performance.averageConfidence * (this.performance.totalCards - 1);
        this.performance.averageConfidence = (currentTotal + confidence) / this.performance.totalCards;

        // Update retention rate
        this.retentionRate = this.performance.correctCount / this.performance.totalCards;

        // Update FSRS progress
        this.updateFSRSProgress(confidence, isCorrect);

        // Check session completion criteria
        if (this.shouldEndSession()) {
            await this.endSession();
        }
    }

    /**
     * Ends session with comprehensive performance analysis
     */
    public async endSession(): Promise<IStudySession> {
        this.endTime = new Date();
        this.status = SessionStatus.COMPLETED;

        // Calculate final performance metrics
        this.performance.timeSpent = Math.floor(
            (this.endTime.getTime() - this.startTime.getTime()) / 1000
        );

        // Update streak if session was successful
        if (this.isSessionSuccessful()) {
            this.performance.studyStreak++;
            this.streak = this.performance.studyStreak;
        }

        return {
            id: this.id,
            userId: this.userId,
            mode: this.mode,
            startTime: this.startTime,
            endTime: this.endTime,
            cardsStudied: this.cardsStudied,
            performance: this.performance,
            voiceEnabled: this.voiceEnabled,
            status: this.status,
            settings: this.settings
        };
    }

    /**
     * Pauses session with state preservation
     */
    public async pauseSession(): Promise<void> {
        if (this.status !== SessionStatus.ACTIVE) {
            throw new Error('Cannot pause non-active session');
        }

        this.status = SessionStatus.PAUSED;
        this.pauseStartTime = new Date();
    }

    /**
     * Resumes session with state restoration
     */
    public async resumeSession(): Promise<void> {
        if (this.status !== SessionStatus.PAUSED) {
            throw new Error('Cannot resume non-paused session');
        }

        // Adjust session duration for pause time
        if (this.pauseStartTime) {
            const pauseDuration = new Date().getTime() - this.pauseStartTime.getTime();
            this.startTime = new Date(this.startTime.getTime() + pauseDuration);
        }

        this.status = SessionStatus.ACTIVE;
        this.pauseStartTime = undefined;
    }

    /**
     * Processes voice recognition metrics
     */
    private processVoiceMetrics(voiceData: VoiceMetrics): void {
        if (voiceData.confidence >= this.settings.voiceConfidenceThreshold) {
            this.voiceConfidence = (this.voiceConfidence + voiceData.confidence) / 2;
        }
    }

    /**
     * Updates FSRS algorithm progress
     */
    private updateFSRSProgress(confidence: number, isCorrect: boolean): void {
        this.performance.fsrsProgress.averageStability *= (this.performance.totalCards - 1);
        this.performance.fsrsProgress.averageStability += confidence;
        this.performance.fsrsProgress.averageStability /= this.performance.totalCards;

        this.performance.fsrsProgress.retentionRate = this.retentionRate;
    }

    /**
     * Determines if session should end based on criteria
     */
    private shouldEndSession(): boolean {
        const timeLimit = this.startTime.getTime() + (this.settings.sessionDuration * 1000);
        const isTimeUp = Date.now() >= timeLimit;
        const isCardLimitReached = this.cardsStudied.length >= this.settings.maxCardsPerSession;
        
        return isTimeUp || isCardLimitReached;
    }

    /**
     * Determines if session was successful based on retention goals
     */
    private isSessionSuccessful(): boolean {
        const minimumCards = this.settings.minCardsPerSession;
        const targetRetention = 0.85; // From technical specifications
        
        return this.performance.totalCards >= minimumCards && 
               this.retentionRate >= targetRetention;
    }
}