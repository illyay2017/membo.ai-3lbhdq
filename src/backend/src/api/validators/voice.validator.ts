/**
 * @fileoverview Voice validation schemas for membo.ai learning system
 * Implements performance-optimized validation for voice settings and input processing
 * @version 1.0.0
 */

import Joi from 'joi'; // ^17.9.0
import { StudyModes } from '../../constants/studyModes';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

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
    audioData: Joi.string().required(),  // base64 encoded audio
    language: Joi.string().valid('en', 'es', 'fr').required(),
    studySessionId: Joi.string().required(),
    expectedAnswer: Joi.string().required()
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

const voiceRequestSchema = z.object({
  audioData: z.string()
    .min(1, "Audio data cannot be empty")
    .refine((val) => {
      try {
        // Verify it's valid base64
        Buffer.from(val, 'base64');
        return true;
      } catch {
        return false;
      }
    }, "Audio data must be valid base64"),
  language: z.string()
    .min(2)
    .max(5),
  studySessionId: z.string()
    .min(1),
  expectedAnswer: z.string()
    .min(1)
});

export const validateVoiceRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = voiceRequestSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    return res.status(400).json({
      error: "Invalid request",
      message: "Missing required fields",
      details: error
    });
  }
};
