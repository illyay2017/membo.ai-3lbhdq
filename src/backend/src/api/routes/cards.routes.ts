/**
 * @fileoverview Express router configuration for flashcard-related API endpoints with
 * comprehensive security measures, FSRS algorithm integration, and role-based access control.
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import { CardController } from '../controllers/CardController';
import { authenticate, authorize, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { rateLimiter } from '../middlewares/rateLimiter.middleware';
import { UserRole } from '../../constants/userRoles';
import { cardValidationSchemas } from '../validators/card.validator';
import { Response, NextFunction } from 'express';

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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const card = await cardController.createCard(req, res, next);
            res.status(201).json(card);
        } catch (error) {
            next(error);
        }
    }
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
        windowMs: 60000,
        max: 50,
        skipFailedRequests: true,
        keyPrefix: 'generate-cards'
    }),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const cards = await cardController.generateCards(req, res, next);
            res.status(201).json(cards);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const card = await cardController.getCard(req, res, next);
            res.json(card);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const cards = await cardController.getUserCards(req, res, next);
            res.json(cards);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const cards = await cardController.getDueCards(req, res, next);
            res.json(cards);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const card = await cardController.recordReview(req, res, next);
            res.json(card);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const card = await cardController.updateCard(req, res, next);
            res.json(card);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            await cardController.deleteCard(req, res, next);
        } catch (error) {
            next(error);
        }
    }
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
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const cards = await cardController.bulkCreateCards(req, res, next);
            res.status(201).json(cards);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
