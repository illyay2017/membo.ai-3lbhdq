/**
 * @fileoverview Defines the interfaces for study session tracking and performance metrics
 * in the membo.ai learning system. Supports FSRS algorithm implementation and voice-enabled learning.
 * @version 1.0.0
 */

import { ICard } from './ICard';
import { StudyModes } from '../constants/studyModes';

/**
 * Interface defining the FSRS algorithm progress metrics for a study session
 */
interface IFSRSProgress {
    /** Average stability factor across all cards in session */
    averageStability: number;
    /** Average difficulty rating across all cards */
    averageDifficulty: number;
    /** Calculated retention rate based on FSRS algorithm */
    retentionRate: number;
    /** Progress through scheduled intervals */
    intervalProgress: number;
}

/**
 * Interface defining comprehensive performance metrics for a study session
 */
export interface IStudyPerformance {
    /** Total number of cards reviewed in session */
    totalCards: number;
    /** Number of cards answered correctly */
    correctCount: number;
    /** Average confidence score (0-1) */
    averageConfidence: number;
    /** Current consecutive study day streak */
    studyStreak: number;
    /** Total time spent studying in seconds */
    timeSpent: number;
    /** FSRS algorithm progress metrics */
    fsrsProgress: IFSRSProgress;
}

/**
 * Interface defining voice recognition configuration for study sessions
 */
interface IVoiceConfig {
    /** Minimum confidence threshold for voice recognition (0-1) */
    recognitionThreshold: number;
    /** Language code for voice recognition (e.g., 'en-US') */
    language: string;
    /** Whether to use native speaker mode for pronunciation */
    useNativeSpeaker: boolean;
}

/**
 * Interface defining FSRS algorithm configuration for the session
 */
interface IFSRSConfig {
    /** Target retention rate (0-1) */
    requestRetention: number;
    /** Maximum interval between reviews in days */
    maximumInterval: number;
    /** Bonus multiplier for easy ratings */
    easyBonus: number;
    /** Penalty multiplier for hard ratings */
    hardPenalty: number;
}

/**
 * Interface defining session-specific settings
 */
interface ISessionSettings {
    /** Duration of study session in minutes */
    sessionDuration: number;
    /** Maximum number of cards to study per session */
    cardsPerSession: number;
    /** Whether to show confidence rating buttons */
    showConfidenceButtons: boolean;
    /** Whether to enable FSRS algorithm */
    enableFSRS: boolean;
    /** Voice recognition configuration */
    voiceConfig: IVoiceConfig;
    /** FSRS algorithm configuration */
    fsrsConfig: IFSRSConfig;
}

/**
 * Primary interface defining the structure of a study session with comprehensive
 * support for FSRS algorithm and voice-enabled learning
 */
export interface IStudySession {
    /** Unique identifier for the study session */
    id: string;

    /** Reference to the user conducting the study session */
    userId: string;

    /** Study mode for the session */
    mode: StudyModes;

    /** Session start timestamp */
    startTime: Date;

    /** Session end timestamp */
    endTime: Date;

    /** Array of card IDs studied in this session */
    cardsStudied: string[];

    /** Comprehensive performance metrics for the session */
    performance: IStudyPerformance;

    /** Whether voice mode is enabled for this session */
    voiceEnabled: boolean;

    /** Current status of the study session */
    status: 'active' | 'completed' | 'paused';

    /** Session-specific settings and configurations */
    settings: ISessionSettings;
}