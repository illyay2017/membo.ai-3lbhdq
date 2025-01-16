/**
 * @fileoverview Defines comprehensive validation schemas for study session operations
 * including mode-specific validation, FSRS configuration validation, and user tier-based access control.
 * @version 1.0.0
 */

import Joi from 'joi'; // ^17.9.0
import { StudyModes } from '../../constants/studyModes';
import { IStudySession } from '../../interfaces/IStudySession';

// Constants for validation rules
const MIN_SESSION_DURATION = 900; // 15 minutes in seconds
const MAX_SESSION_DURATION = 7200; // 2 hours in seconds
const MIN_CARDS_PER_SESSION = 5;
const MAX_CARDS_PER_SESSION = 100;
const MIN_VOICE_CONFIDENCE = 0.85;
const MAX_FSRS_DIFFICULTY = 5;
const DEFAULT_CARDS_PER_SESSION = 20;

/**
 * Validates if the requested study mode is available for user's subscription tier
 */
export const validateStudyMode = (mode: string, userTier: { type: string }): boolean => {
    if (!Object.values(StudyModes).includes(mode as StudyModes)) {
        return false;
    }

    switch (mode) {
        case StudyModes.STANDARD:
            return true; // Available for all tiers
        case StudyModes.VOICE:
            return ['pro', 'power', 'enterprise'].includes(userTier.type);
        case StudyModes.QUIZ:
            return ['power', 'enterprise'].includes(userTier.type);
        default:
            return false;
    }
};

/**
 * Schema for voice-specific settings validation
 */
const voiceSettingsSchema = Joi.object({
    recognitionThreshold: Joi.number()
        .min(MIN_VOICE_CONFIDENCE)
        .max(1.0)
        .required(),
    language: Joi.string()
        .pattern(/^[a-z]{2}-[A-Z]{2}$/)
        .required(),
    useNativeSpeaker: Joi.boolean().required()
}).required();

/**
 * Schema for FSRS configuration validation
 */
const fsrsConfigSchema = Joi.object({
    requestRetention: Joi.number()
        .min(0.7)
        .max(0.95)
        .required(),
    maximumInterval: Joi.number()
        .min(1)
        .max(365)
        .required(),
    easyBonus: Joi.number()
        .min(1.0)
        .max(2.0)
        .required(),
    hardPenalty: Joi.number()
        .min(0.5)
        .max(1.0)
        .required()
}).required();

/**
 * Schema for session settings validation
 */
export const studySettingsSchema = Joi.object({
    sessionDuration: Joi.number()
        .integer()
        .min(MIN_SESSION_DURATION)
        .max(MAX_SESSION_DURATION)
        .required(),
    cardsPerSession: Joi.number()
        .integer()
        .min(MIN_CARDS_PER_SESSION)
        .max(MAX_CARDS_PER_SESSION)
        .default(DEFAULT_CARDS_PER_SESSION),
    showConfidenceButtons: Joi.boolean().required(),
    enableFSRS: Joi.boolean().required(),
    voiceConfig: Joi.when('mode', {
        is: StudyModes.VOICE,
        then: voiceSettingsSchema,
        otherwise: Joi.forbidden()
    }),
    fsrsConfig: Joi.when('enableFSRS', {
        is: true,
        then: fsrsConfigSchema,
        otherwise: Joi.forbidden()
    })
}).required();

/**
 * Schema for study performance metrics validation
 */
const performanceSchema = Joi.object({
    totalCards: Joi.number().integer().min(0).required(),
    correctCount: Joi.number().integer().min(0).required(),
    averageConfidence: Joi.number().min(0).max(1).required(),
    studyStreak: Joi.number().integer().min(0).required(),
    timeSpent: Joi.number().integer().min(0).required(),
    fsrsProgress: Joi.object({
        averageStability: Joi.number().min(0).required(),
        averageDifficulty: Joi.number().max(MAX_FSRS_DIFFICULTY).required(),
        retentionRate: Joi.number().min(0).max(1).required(),
        intervalProgress: Joi.number().min(0).required()
    }).required()
}).required();

/**
 * Schema for creating a new study session
 */
export const createStudySessionSchema = Joi.object<IStudySession>({
    userId: Joi.string().uuid().required(),
    mode: Joi.string()
        .valid(...Object.values(StudyModes))
        .required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')),
    cardsStudied: Joi.array().items(Joi.string().uuid()),
    voiceEnabled: Joi.boolean().required(),
    status: Joi.string().valid('active', 'completed', 'paused').required(),
    settings: studySettingsSchema,
    performance: Joi.when('status', {
        is: 'completed',
        then: performanceSchema,
        otherwise: Joi.forbidden()
    })
}).required();

/**
 * Schema for updating an existing study session
 */
export const updateStudySessionSchema = Joi.object({
    status: Joi.string().valid('active', 'completed', 'paused').required(),
    cardsStudied: Joi.array().items(Joi.string().uuid()),
    endTime: Joi.date().iso(),
    performance: Joi.when('status', {
        is: 'completed',
        then: performanceSchema,
        otherwise: Joi.forbidden()
    }),
    settings: Joi.forbidden() // Settings cannot be modified after session creation
}).required();

/**
 * Validates FSRS algorithm configuration parameters
 */
export const validateFSRSSettings = (fsrsConfig: any): boolean => {
    const { error } = fsrsConfigSchema.validate(fsrsConfig);
    return !error;
};