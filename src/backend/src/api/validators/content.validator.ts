/**
 * @fileoverview Validation schemas and rules for content-related API requests
 * Implements comprehensive input validation and security controls for content capture
 * @version 1.0.0
 */

import Joi from 'joi'; // ^17.9.0
import { IContent, ContentStatus } from '../../interfaces/IContent';

// Constants for content validation
const MAX_CONTENT_LENGTH = 10000;
const MIN_CONTENT_LENGTH = 1;

// Allowed content source types
const ALLOWED_SOURCES = ['web', 'pdf', 'kindle'];

// URL pattern with required protocol
const URL_PATTERN = /^https?:\/\/.+/;

/**
 * Schema for content metadata validation with version support
 */
const metadataSchema = Joi.object({
  contentType: Joi.string().trim().lowercase(),
  language: Joi.string().trim().length(2).lowercase(),
  tags: Joi.array().items(Joi.string().trim().max(50)),
  wordCount: Joi.number().integer().min(0),
  readingTime: Joi.number().min(0),
  confidence: Joi.number().min(0).max(1),
  version: Joi.string().trim()
}).unknown(true); // Allow additional metadata fields

/**
 * Schema for validating content creation requests
 */
export const createContentSchema = Joi.object<IContent>({
  content: Joi.string()
    .required()
    .min(MIN_CONTENT_LENGTH)
    .max(MAX_CONTENT_LENGTH)
    .trim()
    .custom((value, helpers) => {
      // XSS prevention - check for suspicious patterns
      if (/<script|javascript:|data:/i.test(value)) {
        return helpers.error('string.xss');
      }
      return value;
    }),

  source: Joi.string()
    .required()
    .valid(...ALLOWED_SOURCES)
    .lowercase()
    .trim(),

  sourceUrl: Joi.string()
    .allow(null)
    .pattern(URL_PATTERN)
    .trim()
    .max(2048)
    .custom((value, helpers) => {
      if (value && !value.match(URL_PATTERN)) {
        return helpers.error('string.urlFormat');
      }
      return value;
    }),

  metadata: metadataSchema.required(),

  status: Joi.string()
    .valid(ContentStatus.NEW)
    .default(ContentStatus.NEW)
}).options({
  abortEarly: false,
  stripUnknown: true
});

/**
 * Schema for validating content update requests
 */
export const updateContentSchema = Joi.object<Partial<IContent>>({
  content: Joi.string()
    .min(MIN_CONTENT_LENGTH)
    .max(MAX_CONTENT_LENGTH)
    .trim()
    .custom((value, helpers) => {
      if (/<script|javascript:|data:/i.test(value)) {
        return helpers.error('string.xss');
      }
      return value;
    }),

  metadata: metadataSchema
}).min(1).options({
  abortEarly: false,
  stripUnknown: true
});

/**
 * Schema for validating content ID parameters
 */
export const contentIdSchema = Joi.object({
  id: Joi.string()
    .required()
    .guid({ version: 'uuidv4' })
    .messages({
      'string.guid': 'Content ID must be a valid UUID v4'
    })
});

/**
 * Validates content creation request data
 * @param data - The request data to validate
 * @returns Validation result with value or error
 */
export const validateContentCreation = (data: any): Joi.ValidationResult => {
  return createContentSchema.validate(data, {
    convert: true,
    allowUnknown: false
  });
};

/**
 * Validates content update request data
 * @param data - The partial update data to validate
 * @returns Validation result with value or error
 */
export const validateContentUpdate = (data: any): Joi.ValidationResult => {
  return updateContentSchema.validate(data, {
    convert: true,
    allowUnknown: false
  });
};

/**
 * Validates content ID parameter
 * @param id - The content ID to validate
 * @returns Validation result with value or error
 */
export const validateContentId = (id: string): Joi.ValidationResult => {
  return contentIdSchema.validate({ id }, {
    convert: false,
    allowUnknown: false
  });
};