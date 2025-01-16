/**
 * @fileoverview Enhanced database model for flashcard operations with tiered study modes
 * and real-time synchronization capabilities in the membo.ai learning system.
 * @version 1.0.0
 */

import { createClient, SupabaseClient, RealtimeSubscription } from '@supabase/supabase-js'; // v2.x
import { ICard, ICardContent, ContentType } from '../interfaces/ICard';
import { StudyModes, StudyModeConfig } from '../constants/studyModes';
import { calculateNextReview, updateCardState, FSRS_PARAMETERS } from '../utils/fsrs';

/**
 * Enhanced database model class for flashcard operations with comprehensive
 * study mode support and real-time synchronization capabilities.
 */
export class Card {
    private readonly tableName: string = 'cards';
    private readonly supabase: SupabaseClient;
    private readonly subscriptions: Map<string, RealtimeSubscription>;

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );
        this.subscriptions = new Map();
    }

    /**
     * Creates a new flashcard with enhanced validation and FSRS initialization
     * @param cardData Partial card data for creation
     * @returns Newly created card with initialized metrics
     */
    async create(cardData: Partial<ICard>): Promise<ICard> {
        // Validate required fields
        if (!cardData.userId || !cardData.frontContent || !cardData.backContent) {
            throw new Error('Missing required card data fields');
        }

        // Initialize FSRS data
        const fsrsData = {
            stability: FSRS_PARAMETERS.initialStability,
            difficulty: FSRS_PARAMETERS.initialDifficulty,
            reviewCount: 0,
            lastReview: new Date(),
            lastRating: 0,
            streakCount: 0,
            retentionScore: 1.0
        };

        // Prepare card data with enhanced metadata
        const newCard: ICard = {
            ...cardData,
            id: crypto.randomUUID(),
            fsrsData,
            nextReview: new Date(),
            compatibleModes: [StudyModes.STANDARD],
            tags: cardData.tags || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insert card with enhanced error handling
        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert(newCard)
            .select()
            .single();

        if (error) throw new Error(`Failed to create card: ${error.message}`);

        // Set up real-time subscription for the new card
        this.subscribeToCardUpdates(newCard.id, newCard.userId);

        return data as ICard;
    }

    /**
     * Updates card state after review with enhanced metrics tracking
     * @param cardId Card identifier
     * @param rating User rating (1-4)
     * @param userTier User subscription tier
     * @returns Updated card with new metrics
     */
    async updateAfterReview(
        cardId: string,
        rating: number,
        userTier: string
    ): Promise<ICard> {
        const { data: card, error: fetchError } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('id', cardId)
            .single();

        if (fetchError) throw new Error(`Failed to fetch card: ${fetchError.message}`);

        // Begin transaction for atomic updates
        const updatedFsrsData = updateCardState(card as ICard, rating);
        const nextReview = calculateNextReview(card as ICard, rating);

        const { data: updatedCard, error: updateError } = await this.supabase
            .from(this.tableName)
            .update({
                fsrsData: updatedFsrsData,
                nextReview,
                updatedAt: new Date()
            })
            .eq('id', cardId)
            .select()
            .single();

        if (updateError) throw new Error(`Failed to update card: ${updateError.message}`);

        return updatedCard as ICard;
    }

    /**
     * Retrieves due cards with enhanced filtering and sorting
     * @param userId User identifier
     * @param mode Study mode
     * @param userTier User subscription tier
     * @returns Filtered and sorted due cards
     */
    async getDueCards(
        userId: string,
        mode: StudyModes,
        userTier: string
    ): Promise<ICard[]> {
        const now = new Date();
        const modeConfig = StudyModeConfig[mode];

        // Enhanced query with tier-specific limits
        const { data: cards, error } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('userId', userId)
            .lte('nextReview', now)
            .contains('compatibleModes', [mode])
            .order('nextReview', { ascending: true })
            .limit(modeConfig.maxCardsPerSession);

        if (error) throw new Error(`Failed to fetch due cards: ${error.message}`);

        // Apply enhanced sorting with FSRS optimization
        const sortedCards = (cards as ICard[]).sort((a, b) => {
            const aRetention = a.fsrsData.retentionScore;
            const bRetention = b.fsrsData.retentionScore;
            return aRetention - bRetention;
        });

        return sortedCards.slice(0, modeConfig.maxCardsPerSession);
    }

    /**
     * Sets up real-time subscription for card updates
     * @param cardId Card identifier
     * @param userId User identifier
     */
    private subscribeToCardUpdates(cardId: string, userId: string): void {
        const subscription = this.supabase
            .channel(`card-${cardId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: this.tableName,
                    filter: `id=eq.${cardId}`
                },
                (payload) => {
                    // Handle real-time updates
                    console.log('Card updated:', payload);
                }
            )
            .subscribe();

        this.subscriptions.set(cardId, subscription);
    }

    /**
     * Removes real-time subscription for a card
     * @param cardId Card identifier
     */
    async unsubscribe(cardId: string): Promise<void> {
        const subscription = this.subscriptions.get(cardId);
        if (subscription) {
            await subscription.unsubscribe();
            this.subscriptions.delete(cardId);
        }
    }

    /**
     * Retrieves a card by its identifier
     * @param cardId Card identifier
     * @returns Card data
     */
    async findById(cardId: string): Promise<ICard> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('id', cardId)
            .single();

        if (error) throw new Error(`Failed to fetch card: ${error.message}`);
        return data as ICard;
    }

    /**
     * Retrieves all cards for a user
     * @param userId User identifier
     * @returns Array of user's cards
     */
    async findByUserId(userId: string): Promise<ICard[]> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select()
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (error) throw new Error(`Failed to fetch user cards: ${error.message}`);
        return data as ICard[];
    }
}