/**
 * @fileoverview Enhanced REST API controller for flashcard management with comprehensive
 * error handling, performance optimization, and role-based access control.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { asyncHandler } from '../../utils/asyncHandler';
import { RoleValidator } from '../../auth/RoleValidator';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CardService } from '../../services/CardService';
import { validateCreateCard, validateUpdateCard, validateBulkCreateCards } from '../validators/card.validator';
import { StudyModes } from '../../constants/studyModes';
import { ICard } from '../../interfaces/ICard';
import { injectable } from 'tsyringe';

/**
 * Enhanced controller class for flashcard management with performance optimization
 * and comprehensive security controls
 */
export class CardController {
    private cardService: CardService;
    private roleValidator: RoleValidator;

    constructor() {
        this.cardService = new CardService();
        this.roleValidator = new RoleValidator();
    }

    /**
     * Creates a new flashcard with role validation and performance monitoring
     */
    public createCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const startTime = Date.now();

        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
            return;
        }

        // Now TypeScript knows req.user exists
        const userRole = await this.roleValidator.validateUserRole(req.user.id);
        await validateCreateCard(req.body, userRole);

        const card = await this.cardService.createCard({
            ...req.body,
            userId: req.user.id
        });

        // Set cache control headers for performance
        res.set('Cache-Control', 'private, max-age=0, no-cache');
        res.status(201).json({
            success: true,
            data: card,
            metadata: {
                processingTime: Date.now() - startTime
            }
        });
    });

    /**
     * Generates cards from content with AI processing and role-based validation
     */
    public generateCards = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const startTime = Date.now();

        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const userRole = await this.roleValidator.validateUserRole(req.user.id);
        await this.roleValidator.checkRateLimit(req.user.id, 'card_generation');

        const { content, preferredMode = StudyModes.STANDARD } = req.body;
        const cards = await this.cardService.generateCardsFromContent(
            content,
            req.user.id,
            preferredMode
        );

        res.status(201).json({
            success: true,
            data: cards,
            metadata: {
                processingTime: Date.now() - startTime,
                cardCount: cards.length
            }
        });
    });

    /**
     * Retrieves a specific card with access control validation
     */
    public getCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { id } = req.params;
        const card = await this.cardService.getCardById(id);

        // Validate card ownership
        if (card.userId !== req.user.id) {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
            return;
        }

        res.set('Cache-Control', 'private, max-age=300'); // 5-minute cache
        res.json({
            success: true,
            data: card
        });
    });

    /**
     * Retrieves all cards for a user with pagination and filtering
     */
    public getUserCards = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const {
            page = 1,
            limit = 20,
            mode,
            tags
        } = req.query;

        const cards = await this.cardService.getUserCards(
            req.user.id,
            {
                page: Number(page),
                limit: Number(limit),
                mode: mode as StudyModes,
                tags: tags ? (tags as string).split(',') : undefined
            }
        );

        res.set('Cache-Control', 'private, max-age=60'); // 1-minute cache
        res.json({
            success: true,
            data: cards,
            metadata: {
                page: Number(page),
                limit: Number(limit),
                total: cards.length
            }
        });
    });

    /**
     * Retrieves cards due for review with mode-specific optimization
     */
    public getDueCards = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { mode = StudyModes.STANDARD } = req.query;
        const userRole = await this.roleValidator.validateUserRole(req.user.id);

        // Validate study mode access
        if (!this.roleValidator.canAccessStudyMode(userRole, mode as StudyModes)) {
            res.status(403).json({
                success: false,
                error: 'Study mode not available for your subscription tier'
            });
            return;
        }

        const cards = await this.cardService.getDueCards(
            req.user.id,
            mode as StudyModes,
            0.85 // Target retention rate
        );

        res.set('Cache-Control', 'private, max-age=30'); // 30-second cache
        res.json({
            success: true,
            data: cards,
            metadata: {
                count: cards.length,
                mode
            }
        });
    });

    /**
     * Records a card review with FSRS algorithm integration
     */
    public recordReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { cardId } = req.params;
        const { rating, mode = StudyModes.STANDARD } = req.body;

        // Validate rating
        if (rating < 1 || rating > 4) {
            res.status(400).json({
                success: false,
                error: 'Invalid rating value'
            });
            return;
        }

        const updatedCard = await this.cardService.recordReview(
            cardId,
            rating,
            mode as StudyModes
        );

        res.json({
            success: true,
            data: updatedCard,
            metadata: {
                nextReview: updatedCard.nextReview
            }
        });
    });

    /**
     * Updates an existing card with validation and access control
     */
    public updateCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const userRole = await this.roleValidator.validateUserRole(req.user.id);
        
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        // Validate update data
        await validateUpdateCard(req.body, userRole);

        const card = await this.cardService.getCardById(id);
        
        // Validate card ownership
        if (card.userId !== req.user.id) {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
            return;
        }

        const updatedCard = await this.cardService.updateCard(id, req.body);

        res.json({
            success: true,
            data: updatedCard
        });
    });

    /**
     * Deletes a card with ownership validation
     */
    public deleteCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const card = await this.cardService.getCardById(id);

        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        // Validate card ownership
        if (card.userId !== req.user.id) {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
            return;
        }

        await this.cardService.deleteCard(id);

        res.status(204).send();
    });

    public async bulkCreateCards(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const cards = await this.cardService.createCards(req.body);
            res.status(201).json(cards);
        } catch (error) {
            next(error);
        }
    }
}
