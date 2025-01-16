/**
 * Type definitions for study-related functionality in the web client
 * Implements study sessions, performance metrics, and FSRS algorithm types
 * @version 1.0.0
 */

import { STUDY_MODES } from '../constants/study';
import { Card } from './card';

/**
 * Possible states for a study session
 */
export type StudySessionStatus = 'active' | 'completed' | 'paused' | 'failed';

/**
 * Interface defining the structure of a study session in the web client
 * Tracks comprehensive session data, performance metrics, and FSRS progress
 */
export interface StudySession {
    id: string;
    userId: string;
    mode: STUDY_MODES;
    status: StudySessionStatus;
    startTime: Date;
    endTime: Date;
    cardsStudied: Card[];
    performance: StudyPerformance;
    settings: StudySessionSettings;
}

/**
 * Interface defining study performance metrics
 * Tracks comprehensive analytics for learning effectiveness
 */
export interface StudyPerformance {
    totalCards: number;
    correctCount: number;
    incorrectCount: number;
    averageConfidence: number;
    studyStreak: number;
    timeSpent: number;
    fsrsProgress: FSRSProgress;
    retentionRate: number;
}

/**
 * Interface defining study session configuration options
 * Includes settings for different study modes and FSRS parameters
 */
export interface StudySessionSettings {
    sessionDuration: number;
    cardsPerSession: number;
    showConfidenceButtons: boolean;
    enableFSRS: boolean;
    voiceEnabled: boolean;
    voiceConfidenceThreshold: number;
    voiceLanguage: string;
    fsrsParameters: FSRSParameters;
}

/**
 * Interface defining FSRS algorithm progress metrics
 * Tracks spaced repetition effectiveness and learning optimization
 */
export interface FSRSProgress {
    averageStability: number;
    averageDifficulty: number;
    retentionRate: number;
    stabilityGrowthRate: number;
    difficultyGrowthRate: number;
}

/**
 * Interface defining FSRS algorithm configuration parameters
 * Controls spaced repetition behavior and optimization targets
 */
export interface FSRSParameters {
    stabilityThreshold: number;
    difficultyThreshold: number;
    retentionTarget: number;
    learningRate: number;
}

/**
 * Interface defining study session analytics
 * Tracks detailed metrics for learning effectiveness
 */
export interface StudyAnalytics {
    retentionTrend: number[];
    confidenceTrend: number[];
    timePerCard: number;
    streakDays: number;
    performanceImprovement: number;
    fsrsOptimizationScore: number;
}

/**
 * Interface defining voice study mode configuration
 * Controls voice recognition and processing settings
 */
export interface VoiceStudyConfig {
    confidenceThreshold: number;
    language: string;
    retryAttempts: number;
    timeoutDuration: number;
    autoAdvance: boolean;
}

/**
 * Interface defining quiz mode configuration
 * Controls quiz generation and assessment settings
 */
export interface QuizModeConfig {
    questionCount: number;
    timeLimit: number;
    passingScore: number;
    showExplanations: boolean;
    randomizeOrder: boolean;
}