/**
 * @fileoverview Defines comprehensive Joi validation schemas for user-related API endpoints
 * with robust security measures, input sanitization, and role-based validation.
 * Version: joi@17.9.0
 */

import Joi from 'joi';
import { UserRole } from '../../constants/userRoles';
import type { IUser } from '../../interfaces/IUser';

// Security constants for validation rules
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

// Secure password pattern requiring minimum complexity
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// RFC 5322 compliant email pattern
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Language code pattern (ISO 639-1 with region)
const LANGUAGE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/;

/**
 * Comprehensive validation schema for user registration with security measures
 * and input sanitization.
 */
export const registerUserSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .pattern(EMAIL_PATTERN)
    .lowercase()
    .trim()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.pattern.base': 'Email format is invalid',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .pattern(PASSWORD_PATTERN)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.min': `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      'any.required': 'Password is required'
    }),

  firstName: Joi.string()
    .required()
    .trim()
    .min(NAME_MIN_LENGTH)
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, and hyphens',
      'any.required': 'First name is required'
    }),

  lastName: Joi.string()
    .required()
    .trim()
    .min(NAME_MIN_LENGTH)
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, and hyphens',
      'any.required': 'Last name is required'
    })
}).options({ stripUnknown: true, abortEarly: false });

/**
 * Validation schema for user profile updates with role validation
 * and input sanitization.
 */
export const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(NAME_MIN_LENGTH)
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, and hyphens'
    }),

  lastName: Joi.string()
    .trim()
    .min(NAME_MIN_LENGTH)
    .max(NAME_MAX_LENGTH)
    .pattern(/^[a-zA-Z\s-]+$/)
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, and hyphens'
    }),

  role: Joi.string()
    .valid(...Object.values(UserRole))
    .messages({
      'any.only': 'Invalid user role specified'
    })
}).options({ stripUnknown: true, abortEarly: false });

/**
 * Comprehensive validation schema for user preferences with strict type checking
 * and secure value validation.
 */
export const updatePreferencesSchema = Joi.object({
  studyMode: Joi.string()
    .valid('standard', 'quiz', 'voice')
    .trim()
    .lowercase()
    .messages({
      'any.only': 'Invalid study mode specified'
    }),

  voiceEnabled: Joi.boolean()
    .strict()
    .messages({
      'boolean.base': 'Voice enabled must be a boolean value'
    }),

  dailyGoal: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .messages({
      'number.base': 'Daily goal must be a number',
      'number.integer': 'Daily goal must be a whole number',
      'number.min': 'Daily goal must be at least 1',
      'number.max': 'Daily goal cannot exceed 1000'
    }),

  theme: Joi.string()
    .valid('light', 'dark', 'system')
    .trim()
    .lowercase()
    .messages({
      'any.only': 'Invalid theme specified'
    }),

  language: Joi.string()
    .pattern(LANGUAGE_PATTERN)
    .trim()
    .messages({
      'string.pattern.base': 'Language code must be in ISO 639-1 format (e.g., en-US)'
    }),

  notifications: Joi.object({
    email: Joi.boolean()
      .strict()
      .required()
      .messages({
        'boolean.base': 'Email notifications must be a boolean value'
      }),

    push: Joi.boolean()
      .strict()
      .required()
      .messages({
        'boolean.base': 'Push notifications must be a boolean value'
      }),

    studyReminders: Joi.boolean()
      .strict()
      .required()
      .messages({
        'boolean.base': 'Study reminders must be a boolean value'
      })
  }).required()
}).options({ stripUnknown: true, abortEarly: false });