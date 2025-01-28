/**
 * @fileoverview Comprehensive validation utilities for user input, form data, and data structures
 * Implements robust security measures for XSS prevention and input sanitization
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.4
import { LoginCredentials, RegisterCredentials } from '../types/auth';
import { CardCreateInput } from '../types/card';
import { ContentCreateInput, ContentSource } from '../types/content';

// Cache validation schemas for performance
const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 
      'Password must contain uppercase, lowercase, number and special character')
});

const registrationSchema = loginSchema.extend({
  firstName: z.string()
    .min(2, 'First name too short')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s-']+$/, 'First name contains invalid characters'),
  lastName: z.string()
    .min(2, 'Last name too short')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name contains invalid characters')
});

const cardContentSchema = z.object({
  text: z.string()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content too long')
    .transform(str => sanitizeInput(str)),
  type: z.enum(['text', 'markdown', 'html', 'code']),
  metadata: z.object({
    aiModel: z.string().optional(),
    generationPrompt: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    processingTime: z.number().min(0).optional()
  }),
  sourceUrl: z.string().url().optional(),
  aiGenerated: z.boolean()
});

const cardSchema = z.object({
  frontContent: cardContentSchema,
  backContent: cardContentSchema,
  compatibleModes: z.array(z.enum(['standard', 'voice', 'quiz'])),
  tags: z.array(z.string().min(1).max(30)).max(10)
});

const contentSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content too long')
    .transform(str => sanitizeInput(str)),
  metadata: z.object({
    title: z.string().nullable(),
    author: z.string().nullable(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
    source: z.nativeEnum(ContentSource),
    sourceUrl: z.string().url().nullable(),
    pageNumber: z.number().int().positive().nullable(),
    chapterTitle: z.string().nullable(),
    captureContext: z.object({
      section: z.string().optional(),
      highlight: z.string().optional(),
      notes: z.string().optional()
    }).optional()
  })
});

/**
 * Validates login credentials with enhanced security measures
 * @param credentials - Login credentials to validate
 * @returns true if validation passes, throws ZodError if validation fails
 */
export const validateLoginCredentials = (credentials: LoginCredentials): boolean => {
  loginSchema.parse(credentials);
  return true;
};

/**
 * Validates registration data with comprehensive security checks
 * @param data - Registration data to validate
 * @returns true if validation passes, throws ZodError if validation fails
 */
export const validateRegistrationData = (data: RegisterCredentials): boolean => {
  registrationSchema.parse(data);
  return true;
};

/**
 * Validates card creation input with content type checking
 * @param cardData - Card data to validate
 * @returns true if validation passes, throws ZodError if validation fails
 */
export const validateCardInput = (cardData: CardCreateInput): boolean => {
  cardSchema.parse(cardData);
  return true;
};

/**
 * Validates content creation input with source verification
 * @param contentData - Content data to validate
 * @returns true if validation passes, throws ZodError if validation fails
 */
export const validateContentInput = (contentData: ContentCreateInput): boolean => {
  contentSchema.parse(contentData);
  return true;
};

/**
 * Comprehensive input sanitization for XSS prevention
 * @param input - String to sanitize
 * @returns Sanitized string with all security measures applied
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    })[char] || char)
    // Normalize Unicode characters
    .normalize('NFKC')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Trim whitespace
    .trim();
};

// Add this function to the existing validation.ts file
export const validatePassword = (password: string): true | string => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return true;
};

/**
 * Validates email format for frontend validation
 * @param email - Email address to validate
 * @returns true if valid, error message string if invalid
 */
export const validateEmail = (email: string): true | string => {
  // Basic email regex pattern
  const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!email) {
    return 'Email is required';
  }
  
  if (!EMAIL_PATTERN.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return true;
};
