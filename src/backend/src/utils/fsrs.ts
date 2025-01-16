/**
 * @fileoverview Enhanced Free Spaced Repetition Scheduler (FSRS) implementation
 * with tier-specific optimizations and streak maintenance.
 * @version 1.0.0
 */

import { ICard, IFSRSData } from '../interfaces/ICard';

/**
 * Enhanced FSRS algorithm parameters with tier-specific adjustments
 */
export const FSRS_PARAMETERS = {
  weights: [1.0, 1.0, 5.0, -0.5, -0.5, 0.2, 1.4, -0.12, 0.8, 2.0, -0.2, 0.2, 1.0],
  initialStability: 0.5,
  initialDifficulty: 5.0,
  hardPenalty: 0.5,
  easyBonus: 1.3,
  reviewThreshold: 0.85,
  maximumInterval: 365,
  tierModifiers: {
    basic: 1.0,
    pro: 1.2,
    power: 1.5
  },
  streakBonuses: {
    '7days': 1.1,
    '14days': 1.2,
    '30days': 1.3
  }
} as const;

/**
 * Calculates the enhanced probability of successful recall with tier-specific adjustments
 * @param stability Current stability value
 * @param elapsedDays Days since last review
 * @param userTier User subscription tier
 * @returns Optimized probability of successful recall (0-1)
 */
export function calculateRetrievability(
  stability: number,
  elapsedDays: number,
  userTier: string
): number {
  // Apply enhanced FSRS retrievability formula
  const baseRetrievability = Math.exp(
    -1 * elapsedDays / (stability * FSRS_PARAMETERS.tierModifiers[userTier])
  );

  // Apply tier-specific retention optimization
  const tierAdjustedRetrievability = Math.min(
    baseRetrievability * FSRS_PARAMETERS.tierModifiers[userTier],
    1.0
  );

  return Math.max(0, tierAdjustedRetrievability);
}

/**
 * Updates the FSRS state of a card after a review with enhanced tracking
 * @param card Card to update
 * @param rating User rating (1-4: Again, Hard, Good, Easy)
 * @returns Updated FSRS data with streak and retention metrics
 */
export function updateCardState(card: ICard, rating: number): IFSRSData {
  const { fsrsData, userTier } = card;
  const weights = FSRS_PARAMETERS.weights;

  // Calculate new difficulty with tier-specific adjustments
  const difficultyDelta = weights[0] * (rating - 3) +
    weights[1] * (fsrsData.difficulty - FSRS_PARAMETERS.initialDifficulty);
  
  const newDifficulty = Math.min(
    Math.max(
      fsrsData.difficulty + difficultyDelta * FSRS_PARAMETERS.tierModifiers[userTier],
      1.0
    ),
    10.0
  );

  // Update stability using enhanced FSRS formula
  const stabilityMultiplier = rating === 1 ? FSRS_PARAMETERS.hardPenalty :
    rating === 4 ? FSRS_PARAMETERS.easyBonus : 1.0;

  const newStability = fsrsData.stability * (
    1 + weights[2] * Math.exp(-weights[3] * fsrsData.difficulty) *
    (weights[4] * (rating - 3) + weights[5] * stabilityMultiplier)
  );

  // Update streak management
  const streakCount = rating >= 3 ? fsrsData.streakCount + 1 : 0;

  // Calculate retention score based on retrievability
  const elapsedDays = (new Date().getTime() - fsrsData.lastReview.getTime()) / (1000 * 60 * 60 * 24);
  const retentionScore = calculateRetrievability(fsrsData.stability, elapsedDays, userTier);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    reviewCount: fsrsData.reviewCount + 1,
    lastReview: new Date(),
    lastRating: rating,
    streakCount,
    retentionScore
  };
}

/**
 * Calculates the next review date for a card based on enhanced FSRS algorithm
 * with tier-specific adjustments
 * @param card Card to calculate next review for
 * @param rating User rating (1-4: Again, Hard, Good, Easy)
 * @returns Optimized next review date considering user tier and streak
 */
export function calculateNextReview(card: ICard, rating: number): Date {
  const { fsrsData, userTier } = card;
  const now = new Date();

  // Calculate base interval
  let interval = fsrsData.stability * FSRS_PARAMETERS.tierModifiers[userTier];

  // Apply streak bonuses
  if (fsrsData.streakCount >= 30) {
    interval *= FSRS_PARAMETERS.streakBonuses['30days'];
  } else if (fsrsData.streakCount >= 14) {
    interval *= FSRS_PARAMETERS.streakBonuses['14days'];
  } else if (fsrsData.streakCount >= 7) {
    interval *= FSRS_PARAMETERS.streakBonuses['7days'];
  }

  // Apply rating-specific adjustments
  switch (rating) {
    case 1: // Again
      interval = 1; // Reset to 1 day
      break;
    case 2: // Hard
      interval *= FSRS_PARAMETERS.hardPenalty;
      break;
    case 4: // Easy
      interval *= FSRS_PARAMETERS.easyBonus;
      break;
  }

  // Ensure interval is within bounds
  const maxInterval = FSRS_PARAMETERS.maximumInterval * FSRS_PARAMETERS.tierModifiers[userTier];
  interval = Math.min(Math.max(interval, 1), maxInterval);

  // Calculate next review date
  return new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
}