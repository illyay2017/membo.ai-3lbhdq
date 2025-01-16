/**
 * @fileoverview Express router configuration for flashcard-related API endpoints with
 * comprehensive security measures, FSRS algorithm integration, and role-based access control.
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import { CardController } from '../controllers/CardController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { rateLimiter } from '../middlewares/rateLimiter.middleware';
import { UserRole } from '../../constants/userRoles';
import { cardValidationSchemas } from '../validators/card.validator';

// Initialize router and controller
const router = express.Router();
const cardController = new CardController();

/**
 * Create a new flashcard
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.post('/',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000, // 1 minute
        max: 100,
        skipFailedRequests: true,
        keyPrefix: 'create-card'
    }),
    cardController.createCard
);

/**
 * Generate cards using AI processing
 * @security JWT authentication required
 * @rbac PRO_USER, POWER_USER
 */
router.post('/generate',
    authenticate,
    authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000, // 1 minute
        max: 50,
        skipFailedRequests: true,
        keyPrefix: 'generate-cards'
    }),
    cardController.generateCards
);

/**
 * Get a specific card by ID
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.get('/:id',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000,
        max: 200,
        keyPrefix: 'get-card'
    }),
    cardController.getCard
);

/**
 * Get all cards for authenticated user
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.get('/user',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000,
        max: 100,
        keyPrefix: 'list-cards'
    }),
    cardController.getUserCards
);

/**
 * Get cards due for review based on FSRS algorithm
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.get('/due',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000,
        max: 100,
        keyPrefix: 'due-cards'
    }),
    cardController.getDueCards
);

/**
 * Record a card review with FSRS processing
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.post('/:id/review',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.createCardSchema),
    rateLimiter({
        windowMs: 60000,
        max: 200,
        skipFailedRequests: true,
        keyPrefix: 'record-review'
    }),
    cardController.recordReview
);

/**
 * Update an existing card
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.patch('/:id',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.updateCardSchema),
    rateLimiter({
        windowMs: 60000,
        max: 100,
        skipFailedRequests: true,
        keyPrefix: 'update-card'
    }),
    cardController.updateCard
);

/**
 * Delete a card
 * @security JWT authentication required
 * @rbac FREE_USER, PRO_USER, POWER_USER
 */
router.delete('/:id',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    rateLimiter({
        windowMs: 60000,
        max: 50,
        skipFailedRequests: true,
        keyPrefix: 'delete-card'
    }),
    cardController.deleteCard
);

/**
 * Bulk create cards
 * @security JWT authentication required
 * @rbac PRO_USER, POWER_USER
 */
router.post('/bulk',
    authenticate,
    authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
    validateRequest(cardValidationSchemas.bulkCreateSchema),
    rateLimiter({
        windowMs: 60000,
        max: 20,
        skipFailedRequests: true,
        keyPrefix: 'bulk-create'
    }),
    cardController.bulkCreateCards
);

export default router;