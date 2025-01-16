/**
 * @fileoverview Voice validation schemas for membo.ai learning system
 * Implements performance-optimized validation for voice settings and input processing
 * @version 1.0.0
 */

import Joi from 'joi'; // ^17.9.0
import { StudyModes } from '../../constants/studyModes';

/**
 * Supported languages for voice processing
 * Maintained as a constant for performance optimization in validation
 */
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] as const;

/**
 * Default voice settings configuration
 * Used for validation and default value population
 */
const VOICE_SETTINGS_DEFAULTS = {
    enabled: true,
    language: 'en',
    voiceSpeed: 1.0,
    autoPlay: false,
    useNativeVoice: true
} as const;

/**
 * Maximum allowed size for voice input audio data in bytes (5MB)
 */
const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

/**
 * Performance-optimized schema for voice settings validation
 * Implements comprehensive validation rules with custom error messages
 */
export const voiceSettingsSchema = Joi.object({
    enabled: Joi.boolean()
        .required()
        .messages({
            'any.required': 'Voice mode enabled flag is required',
            'boolean.base': 'Voice mode enabled must be a boolean'
        }),

    language: Joi.string()
        .valid(...SUPPORTED_LANGUAGES)
        .required()
        .messages({
            'any.only': 'Invalid language selection',
            'any.required': 'Language selection is required'
        }),

    voiceSpeed: Joi.number()
        .min(0.5)
        .max(2.0)
        .required()
        .messages({
            'number.min': 'Voice speed cannot be slower than 0.5x',
            'number.max': 'Voice speed cannot exceed 2.0x',
            'number.base': 'Voice speed must be a number'
        }),

    autoPlay: Joi.boolean()
        .required()
        .messages({
            'any.required': 'AutoPlay setting is required',
            'boolean.base': 'AutoPlay must be a boolean'
        }),

    useNativeVoice: Joi.boolean()
        .required()
        .messages({
            'any.required': 'Native voice preference is required',
            'boolean.base': 'Native voice preference must be a boolean'
        })
}).options({
    abortEarly: false,
    stripUnknown: true,
    presence: 'required'
});

/**
 * Performance-optimized schema for voice input validation
 * Implements security measures and size limitations
 */
export const voiceInputSchema = Joi.object({
    audioData: Joi.binary()
        .encoding('base64')
        .max(MAX_AUDIO_SIZE)
        .required()
        .messages({
            'binary.max': `Audio data exceeds maximum size of ${MAX_AUDIO_SIZE} bytes`,
            'binary.base': 'Invalid audio data format',
            'any.required': 'Audio data is required'
        }),

    studySessionId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'Invalid study session ID format',
            'any.required': 'Study session ID is required'
        }),

    expectedAnswer: Joi.string()
        .max(1000)
        .required()
        .trim()
        .messages({
            'string.max': 'Expected answer exceeds maximum length of 1000 characters',
            'string.empty': 'Expected answer cannot be empty',
            'any.required': 'Expected answer is required'
        }),

    language: Joi.string()
        .valid(...SUPPORTED_LANGUAGES)
        .required()
        .messages({
            'any.only': 'Unsupported language selection',
            'any.required': 'Language selection is required'
        }),

    confidenceThreshold: Joi.number()
        .min(0)
        .max(1)
        .default(0.7)
        .messages({
            'number.min': 'Confidence threshold must be between 0 and 1',
            'number.max': 'Confidence threshold must be between 0 and 1',
            'number.base': 'Confidence threshold must be a number'
        }),

    studyMode: Joi.string()
        .valid(StudyModes.VOICE)
        .required()
        .messages({
            'any.only': 'Invalid study mode for voice input',
            'any.required': 'Study mode is required'
        })
}).options({
    abortEarly: false,
    stripUnknown: true,
    presence: 'required',
    convert: true
});

/**
 * Type definitions for TypeScript support
 */
export type VoiceSettings = {
    enabled: boolean;
    language: typeof SUPPORTED_LANGUAGES[number];
    voiceSpeed: number;
    autoPlay: boolean;
    useNativeVoice: boolean;
};

export type VoiceInput = {
    audioData: string;
    studySessionId: string;
    expectedAnswer: string;
    language: typeof SUPPORTED_LANGUAGES[number];
    confidenceThreshold?: number;
    studyMode: typeof StudyModes.VOICE;
};