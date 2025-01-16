/**
 * Study-related constants, enums, and configuration settings for the web client
 * Implements FSRS algorithm settings and study mode configurations
 * @version 1.0.0
 */

/**
 * Available study modes in the web application
 */
export enum STUDY_MODES {
    STANDARD = 'standard',
    VOICE = 'voice',
    QUIZ = 'quiz'
}

/**
 * Confidence level values for FSRS algorithm responses
 */
export enum CONFIDENCE_LEVELS {
    AGAIN = 1,
    HARD = 2,
    GOOD = 3,
    EASY = 4
}

/**
 * Type definition for study mode configuration
 */
interface StudyModeConfig {
    sessionDuration: number;          // Duration in seconds
    allowVoiceInput: boolean;         // Whether voice input is enabled
    showConfidenceButtons: boolean;   // Whether to show confidence level buttons
    enableFSRS: boolean;              // Whether FSRS algorithm is enabled
    minCardsPerSession: number;       // Minimum cards per study session
    maxCardsPerSession: number;       // Maximum cards per study session
    [key: string]: any;              // Additional mode-specific properties
}

/**
 * Default configuration settings for each study mode
 */
export const STUDY_MODE_CONFIG: Record<STUDY_MODES, StudyModeConfig> = {
    [STUDY_MODES.STANDARD]: {
        sessionDuration: 3600,            // 1 hour
        allowVoiceInput: false,
        showConfidenceButtons: true,
        enableFSRS: true,
        minCardsPerSession: 10,
        maxCardsPerSession: 50,
        streakMaintenanceThreshold: 14,   // Days
        retentionGoalPercentage: 85       // Target retention rate
    },
    [STUDY_MODES.VOICE]: {
        sessionDuration: 1800,            // 30 minutes
        allowVoiceInput: true,
        showConfidenceButtons: false,
        enableFSRS: true,
        minCardsPerSession: 10,
        maxCardsPerSession: 30,
        voiceConfidenceThreshold: 0.8,    // Minimum confidence for voice recognition
        voiceRecognitionTimeout: 5000,    // Timeout in milliseconds
        voiceInputRetryAttempts: 3        // Number of retry attempts for voice input
    },
    [STUDY_MODES.QUIZ]: {
        sessionDuration: 2700,            // 45 minutes
        allowVoiceInput: false,
        showConfidenceButtons: false,
        enableFSRS: false,
        minCardsPerSession: 20,
        maxCardsPerSession: 50,
        questionsPerQuiz: 20,
        performanceImprovementTarget: 25,  // Target improvement percentage
        quizTimeLimit: 1800               // Time limit in seconds (30 minutes)
    }
};

/**
 * Configuration settings for the FSRS algorithm
 */
export const FSRS_CONFIG = {
    initialInterval: 1440,        // Initial interval in minutes (24 hours)
    minInterval: 1440,           // Minimum interval in minutes
    maxInterval: 43200,          // Maximum interval in minutes (30 days)
    intervalModifier: 1.0,       // Global interval modifier
    easyBonus: 1.3,             // Multiplier for "easy" responses
    hardPenalty: 0.8,           // Multiplier for "hard" responses
    reviewsBeforeGraduation: 4,  // Number of successful reviews before graduating
    
    // Stability modifiers based on response
    stabilityMatrix: {
        again: 0.5,
        hard: 0.8,
        good: 1.0,
        easy: 1.3
    },
    
    // Difficulty modifiers based on response
    difficultyMatrix: {
        again: 1.5,
        hard: 1.2,
        good: 1.0,
        easy: 0.8
    },
    
    // Retention optimization parameters
    retentionOptimization: {
        targetRetention: 0.85,    // Target retention rate (85%)
        minimumStability: 0.7,    // Minimum stability threshold
        maximumStability: 0.95    // Maximum stability threshold
    }
};