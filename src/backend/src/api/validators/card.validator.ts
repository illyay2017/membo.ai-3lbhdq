/**
 * @fileoverview Defines validation schemas and rules for card-related API requests
 * using Joi validation library. Ensures data integrity, type safety, and role-based
 * access control for flashcard operations with enhanced FSRS validation.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ICard, ContentType } from '../../interfaces/ICard';
import { StudyModes, StudyModeConfig } from '../../constants/studyModes';

// Constants for validation limits
const MAX_TEXT_LENGTH = 10000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_BULK_CARDS = 100;

// Base content schema for reusability
const contentSchema = Joi.object({
    text: Joi.string().max(MAX_TEXT_LENGTH).required()
        .custom((value, helpers) => {
            // XSS prevention - check for suspicious HTML/script tags
            if (/<script|javascript:|data:/i.test(value)) {
                return helpers.error('string.xss');
            }
            return value;
        }),
    type: Joi.string().valid(...Object.values(ContentType)).required(),
    metadata: Joi.object({
        sourceUrl: Joi.string().uri().optional(),
        sourcePage: Joi.number().positive().optional(),
        sourcePosition: Joi.object({
            start: Joi.number().min(0).required(),
            end: Joi.number().min(Joi.ref('start')).required()
        }).optional(),
        languageCode: Joi.string().length(2).optional(),
        codeLanguage: Joi.string().when('type', {
            is: ContentType.CODE,
            then: Joi.required()
        }),
        aiGenerated: Joi.boolean().required(),
        generationPrompt: Joi.string().when('aiGenerated', {
            is: true,
            then: Joi.required()
        }),
        lastModifiedBy: Joi.string().required()
    }).required()
});

// FSRS data validation schema
const fsrsDataSchema = Joi.object({
    stability: Joi.number().min(0).max(1).required(),
    difficulty: Joi.number().min(0).max(1).required(),
    reviewCount: Joi.number().min(0).required(),
    lastReview: Joi.date().allow(null),
    lastRating: Joi.number().min(0).max(4).required()
});

/**
 * Role-based study mode access validation
 */
const validateStudyModeAccess = (modes: StudyModes[], userRole: string): boolean => {
    const rolePermissions = {
        'free': [StudyModes.STANDARD],
        'pro': [StudyModes.STANDARD, StudyModes.VOICE],
        'power': Object.values(StudyModes),
        'admin': Object.values(StudyModes)
    };
    
    return modes.every(mode => 
        rolePermissions[userRole]?.includes(mode) || userRole === 'admin'
    );
};

/**
 * Create card validation schema with role-based validation
 */
export const validateCreateCard = async (requestBody: Partial<ICard>, userRole?: string) => {
    const createCardSchema = Joi.object({
        frontContent: contentSchema.required(),
        backContent: contentSchema.required(),
        fsrsData: fsrsDataSchema.required(),
        compatibleModes: Joi.array()
            .items(Joi.string().valid(...Object.values(StudyModes)))
            .required(),
        tags: Joi.array()
            .items(Joi.string().max(MAX_TAG_LENGTH))
            .max(MAX_TAGS)
            .unique()
            .optional()
    }).options({ 
        abortEarly: false,
        messages: {
            'string.xss': 'Content contains potentially unsafe HTML or scripts',
            'array.studyModeAccess': 'User role does not have access to selected study modes'
        }
    });

    return createCardSchema.validateAsync(requestBody);
};

/**
 * Update card validation schema with partial update support
 */
export const validateUpdateCard = async (requestBody: Partial<ICard>, userRole?: string) => {
    const updateCardSchema = Joi.object({
        frontContent: contentSchema.optional(),
        backContent: contentSchema.optional(),
        fsrsData: fsrsDataSchema.optional(),
        compatibleModes: Joi.array()
            .items(Joi.string().valid(...Object.values(StudyModes)))
            .custom((value, helpers) => {
                if (!userRole || !validateStudyModeAccess(value, userRole)) {
                    return helpers.error('array.studyModeAccess');
                }
                return value;
            })
            .optional(),
        tags: Joi.array()
            .items(Joi.string().max(MAX_TAG_LENGTH))
            .max(MAX_TAGS)
            .unique()
            .optional()
    }).min(1) // Require at least one field to be updated
    .options({
        abortEarly: false,
        messages: {
            'string.xss': 'Content contains potentially unsafe HTML or scripts',
            'array.studyModeAccess': 'User role does not have access to selected study modes',
            'object.min': 'At least one field must be provided for update'
        }
    });

    return updateCardSchema.validateAsync(requestBody);
};

/**
 * Bulk create cards validation schema with enhanced batch validation
 */
export const validateBulkCreateCards = async (requestBody: { cards: Partial<ICard>[] }, userRole?: string) => {
    const bulkCreateSchema = Joi.object({
        cards: Joi.array()
            .items(Joi.object({
                frontContent: contentSchema.required(),
                backContent: contentSchema.required(),
                fsrsData: fsrsDataSchema.required(),
                compatibleModes: Joi.array()
                    .items(Joi.string().valid(...Object.values(StudyModes)))
                    .custom((value, helpers) => {
                        if (!userRole || !validateStudyModeAccess(value, userRole)) {
                            return helpers.error('array.studyModeAccess');
                        }
                        return value;
                    })
                    .required(),
                tags: Joi.array()
                    .items(Joi.string().max(MAX_TAG_LENGTH))
                    .max(MAX_TAGS)
                    .unique()
                    .optional()
            }))
            .min(1)
            .max(MAX_BULK_CARDS)
            .required()
    }).options({
        abortEarly: false,
        messages: {
            'string.xss': 'Content contains potentially unsafe HTML or scripts',
            'array.studyModeAccess': 'User role does not have access to selected study modes',
            'array.max': `Bulk creation limited to ${MAX_BULK_CARDS} cards`,
            'array.min': 'At least one card must be provided for bulk creation'
        }
    });

    return bulkCreateSchema.validateAsync(requestBody);
};

// Export validation schemas and functions
export const cardValidationSchemas = {
    createCardSchema: validateCreateCard,
    updateCardSchema: validateUpdateCard,
    bulkCreateSchema: validateBulkCreateCards
};
