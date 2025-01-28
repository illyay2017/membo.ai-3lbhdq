/**
 * @fileoverview Enhanced service layer implementation for flashcard management with
 * comprehensive retention tracking and FSRS algorithm integration.
 * @version 1.0.0
 */

import { ContentType, ICard } from '../interfaces/ICard';
import { Card } from '../models/Card';
import { FSRSAlgorithm } from '../core/study/FSRSAlgorithm';
import { CardGenerator } from '../core/ai/cardGenerator';
import { StudyModes } from '../constants/studyModes';
import { openai } from '../config/openai';
import { IStudySession } from '../interfaces/IStudySession';
import Redis from 'ioredis';
import { ContentStatus } from '../interfaces/IContent';

/**
 * Enhanced service class for flashcard management with retention optimization
 */
export class CardService {
    private cardModel: Card;
    private fsrsAlgorithm: FSRSAlgorithm;
    private cardGenerator: CardGenerator;

    constructor() {
        this.cardModel = new Card();
        this.fsrsAlgorithm = new FSRSAlgorithm();
        this.cardGenerator = new CardGenerator(
            openai,
            new Redis(process.env.REDIS_URL),
            {
                maxCards: 50,
                preferredTypes: [ContentType.TEXT],
                targetModes: [StudyModes.STANDARD, StudyModes.VOICE]
            }
        );
    }

    /**
     * Creates a new flashcard with enhanced retention tracking
     * @param cardData Partial card data for creation
     * @returns Created card with initialized retention metrics
     */
    public async createCard(cardData: Partial<ICard>): Promise<ICard> {
        try {
            // Initialize FSRS data with retention tracking
            const initialFSRSData = {
                stability: 0.5,
                difficulty: 0.3,
                reviewCount: 0,
                lastReview: new Date(),
                lastRating: 0,
                retentionScore: 1.0,
                streakCount: 0
            };

            const enhancedCardData: Partial<ICard> = {
                ...cardData,
                fsrsData: initialFSRSData,
                nextReview: new Date(),
                compatibleModes: [StudyModes.STANDARD],
                tags: cardData.tags || []
            };

            const createdCard = await this.cardModel.create(enhancedCardData);
            return createdCard;
        } catch (error) {
            throw new Error(`Failed to create card: ${error.message}`);
        }
    }

    /**
     * Generates optimized cards from content using enhanced AI processing
     * @param content Raw content for card generation
     * @param userId User identifier
     * @param preferredMode Preferred study mode
     * @returns Array of generated cards with mode compatibility
     */
    public async generateCardsFromContent(
        content: string,
        userId: string,
        preferredMode: StudyModes
    ): Promise<ICard[]> {
        try {
            const contentData = {
                id: crypto.randomUUID(),
                userId,
                content,
                metadata: {
                    contentType: 'text',
                    language: 'en',
                    aiGenerated: true
                },
                source: 'user_input',
                sourceUrl: null,
                status: ContentStatus.NEW,
                createdAt: new Date(),
                updatedAt: new Date(),
                processedAt: new Date()
            };

            const generatedCards = await this.cardGenerator.generateFromContent(contentData);

            // Process and create cards with retention tracking
            const cards = await Promise.all(
                generatedCards.map(card => this.createCard({
                    ...card,
                    userId,
                    compatibleModes: [
                        StudyModes.STANDARD,
                        ...(this.isVoiceCompatible(card) ? [StudyModes.VOICE] : [])
                    ]
                }))
            );

            return cards;
        } catch (error) {
            throw new Error(`Failed to generate cards: ${error.message}`);
        }
    }

    /**
     * Gets cards due for review with retention optimization
     * @param userId User identifier
     * @param mode Study mode
     * @param targetRetention Target retention score
     * @returns Prioritized array of due cards
     */
    public async getDueCards(
        userId: string,
        mode: StudyModes,
        targetRetention: number = 0.85
    ): Promise<ICard[]> {
        try {
            const dueCards = await this.cardModel.getDueCards(userId, mode, 'standard');

            // Apply retention-based prioritization
            const prioritizedCards = dueCards.sort((a, b) => {
                const aRetention = a.fsrsData.retentionScore || 0;
                const bRetention = b.fsrsData.retentionScore || 0;
                const aDistance = Math.abs(targetRetention - aRetention);
                const bDistance = Math.abs(targetRetention - bRetention);
                return aDistance - bDistance;
            });

            return prioritizedCards;
        } catch (error) {
            throw new Error(`Failed to get due cards: ${error.message}`);
        }
    }

    /**
     * Records a card review with comprehensive metrics update
     * @param cardId Card identifier
     * @param rating User rating (1-4)
     * @param mode Study mode used
     * @returns Updated card with new metrics
     */
    public async recordReview(cardId: string, rating: number, mode: StudyModes): Promise<ICard> {
        try {
            const card = await this.cardModel.findById(cardId);
            if (!card) {
                throw new Error('Card not found');
            }

            // Create a proper IStudySession object
            const studySession: IStudySession = {
                id: crypto.randomUUID(),
                userId: card.userId,
                mode,
                startTime: new Date(),
                endTime: new Date(),
                voiceEnabled: mode === StudyModes.VOICE,
                cardsStudied: 1,
                performance: {
                    totalCards: 1,
                    correctCount: rating >= 3 ? 1 : 0,
                    averageConfidence: rating / 4,
                    studyStreak: card.fsrsData.streakCount || 0,
                    timeSpent: 0,
                    fsrsProgress: {
                        averageStability: card.fsrsData.stability,
                        averageDifficulty: card.fsrsData.difficulty,
                        retentionRate: card.fsrsData.retentionScore || 0,
                        intervalProgress: 0
                    }
                }
            };

            const updatedFSRSData = this.fsrsAlgorithm.updateCardFSRSData(
                card,
                rating,
                studySession
            );

            // Calculate next review date
            const nextReview = this.fsrsAlgorithm.calculateNextReview(
                card,
                rating,
                'standard',
                {
                    voiceEnabled: mode === StudyModes.VOICE,
                    performance: {
                        studyStreak: updatedFSRSData.streakCount
                    }
                }
            );

            // Update card with new metrics
            const updatedCard = await this.cardModel.updateAfterReview(
                cardId,
                rating,
                'standard'
            );

            return updatedCard;
        } catch (error) {
            throw new Error(`Failed to record review: ${error.message}`);
        }
    }

    /**
     * Checks if a card is compatible with voice mode
     * @param card Card to check
     * @returns Boolean indicating voice mode compatibility
     */
    private isVoiceCompatible(card: ICard): boolean {
        return (
            card.frontContent.text.length < 200 &&
            card.backContent.text.length < 500 &&
            !card.frontContent.text.includes('```') &&
            !card.backContent.text.includes('```')
        );
    }

    public async createCards(cardsData: Partial<ICard>[]): Promise<ICard[]> {
        try {
            const cards = await Promise.all(
                cardsData.map(cardData => this.createCard(cardData))
            );
            return cards;
        } catch (error) {
            throw new Error(`Failed to create cards: ${error.message}`);
        }
    }

    public async deleteCard(cardId: string): Promise<void> {
        try {
            await this.cardModel.delete(cardId);
        } catch (error) {
            throw new Error(`Failed to delete card: ${error.message}`);
        }
    }
}
