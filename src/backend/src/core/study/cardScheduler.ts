/**
 * @fileoverview Core service responsible for scheduling and managing flashcard review timing
 * using the FSRS algorithm. Implements tiered study modes and voice-enabled learning capabilities.
 * @version 1.0.0
 */

import { ICard } from '../../interfaces/ICard';
import { IStudySession } from '../../interfaces/IStudySession';
import { FSRSAlgorithm } from './FSRSAlgorithm';
import { Card } from '../../models/Card';
import dayjs from 'dayjs'; // ^1.11.0

/**
 * Manages the scheduling of flashcard reviews using the FSRS algorithm
 * with support for multiple study modes and voice capabilities
 */
export class CardScheduler {
    private readonly fsrsAlgorithm: FSRSAlgorithm;
    private readonly cardModel: Card;
    private readonly retentionThreshold: number;
    private readonly streakDays: number;

    constructor(
        fsrsAlgorithm: FSRSAlgorithm,
        cardModel: Card,
        retentionThreshold: number = 0.85,
        streakDays: number = 14
    ) {
        this.fsrsAlgorithm = fsrsAlgorithm;
        this.cardModel = cardModel;
        this.retentionThreshold = retentionThreshold;
        this.streakDays = streakDays;
    }

    /**
     * Retrieves the next batch of cards due for review based on user tier and study mode
     * @param userId User identifier
     * @param mode Study mode (standard, voice, quiz)
     * @param limit Maximum number of cards to retrieve
     * @returns Array of cards due for review
     */
    public async getNextDueCards(
        userId: string,
        mode: string,
        limit: number
    ): Promise<ICard[]> {
        // Get due cards from database with mode-specific filtering
        const dueCards = await this.cardModel.getDueCards(userId, mode, limit);

        // Apply FSRS-based prioritization
        const prioritizedCards = this.prioritizeCards(dueCards, mode);

        // Apply retention-based filtering
        const filteredCards = prioritizedCards.filter(card => 
            (card.fsrsData.retentionScore || 0) < this.retentionThreshold
        );

        return filteredCards.slice(0, limit);
    }

    /**
     * Processes a card review and updates its schedule while tracking retention metrics
     * @param cardId Card identifier
     * @param rating User rating (1-4)
     * @param isVoiceMode Whether voice mode is enabled
     * @returns Updated card with new schedule and metrics
     */
    public async processReview(
        cardId: string,
        rating: number,
        isVoiceMode: boolean
    ): Promise<ICard> {
        // Retrieve current card state
        const card = await this.cardModel.findById(cardId);

        // Create mock session for FSRS calculations
        const session: IStudySession = {
            voiceEnabled: isVoiceMode,
            performance: {
                averageConfidence: isVoiceMode ? 0.85 : 1.0,
                studyStreak: card.fsrsData.streakCount || 0,
                correctCount: rating >= 3 ? 1 : 0,
                totalCards: 1,
                timeSpent: 0,
                fsrsProgress: {
                    averageStability: card.fsrsData.stability,
                    averageDifficulty: card.fsrsData.difficulty,
                    retentionRate: card.fsrsData.retentionScore || 0,
                    intervalProgress: 0
                }
            }
        } as IStudySession;

        // Calculate new FSRS data
        const updatedFSRSData = this.fsrsAlgorithm.updateCardFSRSData(
            card,
            rating,
            session
        );

        // Calculate next review date
        const nextReview = this.fsrsAlgorithm.calculateNextReview(
            card,
            rating,
            'standard', // Default to standard tier if not specified
            session
        );

        // Update card in database
        const updatedCard = await this.cardModel.updateAfterReview(
            cardId,
            rating,
            'standard'
        );

        return updatedCard;
    }

    /**
     * Calculates optimal number of cards for a study session based on user performance
     * @param userId User identifier
     * @param mode Study mode
     * @returns Recommended number of cards
     */
    public async calculateOptimalBatchSize(
        userId: string,
        mode: string
    ): Promise<number> {
        const cards = await this.cardModel.findByUserId(userId);
        
        // Calculate average retention rate
        const avgRetention = cards.reduce((sum, card) => 
            sum + (card.fsrsData.retentionScore || 0), 0
        ) / Math.max(cards.length, 1);

        // Base batch size on retention rate and mode
        let batchSize = 20; // Default size
        
        if (avgRetention > 0.9) {
            batchSize = 30; // Increase for high performers
        } else if (avgRetention < 0.7) {
            batchSize = 15; // Decrease for struggling users
        }

        // Adjust for voice mode
        if (mode === 'voice') {
            batchSize = Math.floor(batchSize * 0.7); // Reduce batch size for voice mode
        }

        return batchSize;
    }

    /**
     * Prioritizes cards based on FSRS data, learning patterns, and study mode
     * @param cards Array of cards to prioritize
     * @param mode Study mode
     * @returns Prioritized array of cards
     */
    private prioritizeCards(cards: ICard[], mode: string): ICard[] {
        return cards.sort((a, b) => {
            // Primary sort by retention score (ascending)
            const retentionDiff = (a.fsrsData.retentionScore || 0) - 
                                (b.fsrsData.retentionScore || 0);
            
            if (retentionDiff !== 0) return retentionDiff;

            // Secondary sort by stability (ascending)
            const stabilityDiff = a.fsrsData.stability - b.fsrsData.stability;
            if (stabilityDiff !== 0) return stabilityDiff;

            // Tertiary sort by review count (descending)
            return b.fsrsData.reviewCount - a.fsrsData.reviewCount;
        });
    }
}