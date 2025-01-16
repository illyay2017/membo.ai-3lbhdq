/**
 * @fileoverview Enhanced implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm
 * with support for voice mode, user tiers, and streak maintenance targeting 85% retention rate.
 * @version 1.0.0
 */

import { ICard } from '../../interfaces/ICard';
import { IStudySession } from '../../interfaces/IStudySession';
import dayjs from 'dayjs'; // ^1.11.0

/**
 * Interface for enhanced FSRS data with voice mode and streak support
 */
interface IEnhancedFSRSData {
    stability: number;
    difficulty: number;
    reviewCount: number;
    lastReview: Date;
    lastRating: number;
    voiceConfidenceHistory?: number[];
    streakBonus?: number;
    retentionRate?: number;
}

/**
 * Enhanced implementation of the Free Spaced Repetition Scheduler algorithm
 * optimized for >85% knowledge retention and 14+ day streak maintenance
 */
export class FSRSAlgorithm {
    private readonly defaultStability: number = 0.5;
    private readonly defaultDifficulty: number = 0.3;
    private readonly minInterval: number = 4; // hours
    private readonly maxInterval: number = 365; // days
    private readonly retentionTarget: number = 0.85;
    
    // Tier-based maximum intervals (in days)
    private readonly tierBasedIntervals: Record<string, number> = {
        free: 30,
        pro: 180,
        power: 365
    };

    // Voice mode confidence impact
    private readonly voiceModeMultiplier: number = 1.2;
    
    // Streak bonus factors (days: multiplier)
    private readonly streakBonusFactors: Record<number, number> = {
        7: 1.1,   // 7-day streak
        14: 1.2,  // 14-day streak
        30: 1.3,  // 30-day streak
        60: 1.4   // 60-day streak
    };

    /**
     * Calculates the next review date based on performance, user tier, and study mode
     */
    public calculateNextReview(
        card: ICard,
        rating: number,
        userTier: string,
        session: IStudySession
    ): Date {
        const fsrsData = card.fsrsData;
        const performance = session.performance;
        
        // Calculate base stability with enhanced formula
        let newStability = this.calculateStability(
            fsrsData.stability,
            rating,
            fsrsData.difficulty
        );

        // Apply voice mode adjustments if applicable
        if (session.voiceEnabled && session.performance.averageConfidence > 0.85) {
            newStability *= this.voiceModeMultiplier;
        }

        // Apply streak bonus
        const streakBonus = this.calculateStreakBonus(performance.studyStreak);
        newStability *= streakBonus;

        // Calculate optimal interval
        const optimalInterval = this.calculateOptimalInterval(
            newStability,
            fsrsData.difficulty,
            rating
        );

        // Apply tier-based limits
        const maxTierInterval = this.tierBasedIntervals[userTier] || this.tierBasedIntervals.free;
        const boundedInterval = Math.min(optimalInterval, maxTierInterval);

        // Calculate next review date
        const nextReview = dayjs()
            .add(boundedInterval * 24, 'hour')
            .toDate();

        return nextReview;
    }

    /**
     * Updates card's FSRS data with enhanced performance tracking
     */
    public updateCardFSRSData(
        card: ICard,
        rating: number,
        session: IStudySession
    ): IEnhancedFSRSData {
        const currentData = card.fsrsData;
        
        // Calculate new stability with voice impact
        let newStability = this.calculateStability(
            currentData.stability,
            rating,
            currentData.difficulty
        );

        if (session.voiceEnabled) {
            newStability *= this.calculateVoiceImpact(session);
        }

        // Update difficulty
        const newDifficulty = this.calculateNewDifficulty(
            currentData.difficulty,
            rating,
            session.performance.studyStreak
        );

        // Calculate retention rate
        const retentionRate = this.calculateRetentionRate(
            rating,
            currentData.reviewCount,
            session.performance.averageConfidence
        );

        const enhancedData: IEnhancedFSRSData = {
            stability: newStability,
            difficulty: newDifficulty,
            reviewCount: currentData.reviewCount + 1,
            lastReview: new Date(),
            lastRating: rating,
            voiceConfidenceHistory: [
                ...(currentData as IEnhancedFSRSData).voiceConfidenceHistory || [],
                session.voiceEnabled ? session.performance.averageConfidence : null
            ].filter(Boolean),
            streakBonus: this.calculateStreakBonus(session.performance.studyStreak),
            retentionRate
        };

        return enhancedData;
    }

    /**
     * Calculates stability based on rating and current difficulty
     */
    private calculateStability(
        currentStability: number,
        rating: number,
        difficulty: number
    ): number {
        const stabilityFactor = Math.pow(1 + rating / 5, 1 - difficulty);
        return Math.max(
            currentStability * stabilityFactor,
            this.defaultStability
        );
    }

    /**
     * Calculates optimal interval based on stability and performance
     */
    private calculateOptimalInterval(
        stability: number,
        difficulty: number,
        rating: number
    ): number {
        const baseInterval = Math.pow(stability * (1 - difficulty), 1 / (1 + rating / 5));
        return Math.max(
            this.minInterval / 24,
            Math.min(baseInterval, this.maxInterval)
        );
    }

    /**
     * Calculates streak bonus based on consecutive study days
     */
    private calculateStreakBonus(streak: number): number {
        let bonus = 1.0;
        for (const [days, multiplier] of Object.entries(this.streakBonusFactors)) {
            if (streak >= parseInt(days)) {
                bonus = multiplier;
            }
        }
        return bonus;
    }

    /**
     * Calculates voice mode impact on stability
     */
    private calculateVoiceImpact(session: IStudySession): number {
        const confidence = session.performance.averageConfidence;
        if (confidence > 0.95) return this.voiceModeMultiplier;
        if (confidence > 0.85) return 1.1;
        return 1.0;
    }

    /**
     * Calculates new difficulty based on rating and streak
     */
    private calculateNewDifficulty(
        currentDifficulty: number,
        rating: number,
        streak: number
    ): number {
        let difficulty = currentDifficulty;
        
        // Adjust difficulty based on rating
        if (rating >= 4) {
            difficulty *= 0.9; // Decrease difficulty for good performance
        } else if (rating <= 2) {
            difficulty *= 1.1; // Increase difficulty for poor performance
        }

        // Apply streak-based difficulty reduction
        const streakBonus = this.calculateStreakBonus(streak);
        difficulty /= streakBonus;

        // Bound difficulty between 0.1 and 0.9
        return Math.max(0.1, Math.min(0.9, difficulty));
    }

    /**
     * Calculates retention rate based on performance metrics
     */
    private calculateRetentionRate(
        rating: number,
        reviewCount: number,
        confidence: number
    ): number {
        const baseRetention = (rating / 5) * 0.7;
        const experienceBonus = Math.min(0.2, reviewCount * 0.01);
        const confidenceImpact = confidence * 0.1;
        
        return Math.min(1.0, baseRetention + experienceBonus + confidenceImpact);
    }
}