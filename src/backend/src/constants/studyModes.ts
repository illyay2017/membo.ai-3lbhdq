/**
 * @fileoverview Defines the available study modes and their configurations in the membo.ai learning system.
 * This includes standard flashcard review, voice-enabled learning, and quiz mode options with comprehensive
 * settings for each mode type.
 * @version 1.0.0
 */

/**
 * Enumeration of available study modes in the system, defining the core learning interaction types
 */
export enum StudyModes {
    STANDARD = 'standard',
    VOICE = 'voice',
    QUIZ = 'quiz'
}

/**
 * Interface for FSRS (Free Spaced Repetition Scheduler) parameters
 */
interface FSRSParameters {
    enabled: boolean;
    initialInterval: number; // in minutes
    intervalModifier: number;
}

/**
 * Interface for voice recognition settings
 */
interface VoiceSettings {
    recognitionTimeout: number; // in milliseconds
    maxRetries: number;
    languageDetection: boolean;
    confidenceThreshold: number;
}

/**
 * Interface for quiz-specific settings
 */
interface QuizSettings {
    timePerQuestion: number; // in seconds
    passThreshold: number;
    allowSkip: boolean;
    randomizeOrder: boolean;
    showProgress: boolean;
    immediateAnswers: boolean;
}

/**
 * Comprehensive configuration settings for each study mode
 */
export const StudyModeConfig = {
    STANDARD: {
        sessionDuration: 3600, // 1 hour in seconds
        allowVoiceInput: false,
        showConfidenceButtons: true,
        enableFSRS: true,
        minCardsPerSession: 10,
        maxCardsPerSession: 50,
        confidenceOptions: ['Again', 'Hard', 'Good', 'Easy'],
        fsrsParameters: {
            enabled: true,
            initialInterval: 1440, // 24 hours in minutes
            intervalModifier: 1.0
        },
        sessionTimeoutWarning: 300 // 5 minutes warning before session ends
    },

    VOICE: {
        sessionDuration: 1800, // 30 minutes in seconds
        allowVoiceInput: true,
        showConfidenceButtons: false,
        enableFSRS: true,
        voiceConfidenceThreshold: 0.85,
        minCardsPerSession: 10,
        maxCardsPerSession: 30,
        voiceSettings: {
            recognitionTimeout: 5000, // 5 seconds
            maxRetries: 3,
            languageDetection: true,
            confidenceThreshold: 0.85
        },
        fsrsParameters: {
            enabled: true,
            initialInterval: 1440, // 24 hours in minutes
            intervalModifier: 1.2 // Slightly higher interval modifier for voice mode
        },
        sessionTimeoutWarning: 180 // 3 minutes warning before session ends
    },

    QUIZ: {
        sessionDuration: 2700, // 45 minutes in seconds
        allowVoiceInput: false,
        showConfidenceButtons: false,
        enableFSRS: false,
        questionsPerQuiz: 20,
        minCardsPerSession: 20,
        maxCardsPerSession: 50,
        quizSettings: {
            timePerQuestion: 60,
            passThreshold: 0.7, // 70% correct required to pass
            allowSkip: true,
            randomizeOrder: true,
            showProgress: true,
            immediateAnswers: false
        },
        sessionTimeoutWarning: 240 // 4 minutes warning before session ends
    }
} as const;

/**
 * Type definition for study mode configurations to ensure type safety
 */
export type StudyModeConfigType = typeof StudyModeConfig;

/**
 * Type definition for individual study mode settings
 */
export type StudyModeSettings = StudyModeConfigType[keyof StudyModeConfigType];