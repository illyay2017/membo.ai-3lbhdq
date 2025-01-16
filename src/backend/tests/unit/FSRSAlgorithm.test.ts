/**
 * @fileoverview Unit tests for the Free Spaced Repetition Scheduler (FSRS) algorithm
 * Verifies core functionality, voice mode integration, tier limits, and retention optimization
 * @version 1.0.0
 */

import { FSRSAlgorithm } from '../../src/core/study/FSRSAlgorithm';
import { ICard } from '../../src/interfaces/ICard';
import { createMockCard } from '../utils/testHelpers';
import { StudyModes } from '../../src/constants/studyModes';
import dayjs from 'dayjs'; // ^1.11.0

describe('FSRSAlgorithm', () => {
    let fsrs: FSRSAlgorithm;
    let mockCard: ICard;

    beforeEach(() => {
        fsrs = new FSRSAlgorithm();
        mockCard = createMockCard({
            fsrsData: {
                stability: 0.5,
                difficulty: 0.3,
                reviewCount: 0,
                lastReview: new Date(),
                lastRating: 0
            }
        });
    });

    describe('calculateNextReview', () => {
        it('should increase interval for high performance ratings', () => {
            const session = {
                voiceEnabled: false,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.9
                }
            };

            const nextReview = fsrs.calculateNextReview(mockCard, 5, 'pro', session);
            const interval = dayjs(nextReview).diff(dayjs(), 'hour');

            expect(interval).toBeGreaterThan(24);
            expect(interval).toBeLessThanOrEqual(180 * 24); // Pro tier max
        });

        it('should decrease interval for low performance ratings', () => {
            const session = {
                voiceEnabled: false,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.6
                }
            };

            const nextReview = fsrs.calculateNextReview(mockCard, 1, 'pro', session);
            const interval = dayjs(nextReview).diff(dayjs(), 'hour');

            expect(interval).toBeGreaterThanOrEqual(4); // Minimum interval
            expect(interval).toBeLessThan(24);
        });

        it('should respect tier-based maximum intervals', () => {
            const session = {
                voiceEnabled: false,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 1.0
                }
            };

            // Test free tier limit
            const freeNextReview = fsrs.calculateNextReview(mockCard, 5, 'free', session);
            const freeInterval = dayjs(freeNextReview).diff(dayjs(), 'day');
            expect(freeInterval).toBeLessThanOrEqual(30);

            // Test pro tier limit
            const proNextReview = fsrs.calculateNextReview(mockCard, 5, 'pro', session);
            const proInterval = dayjs(proNextReview).diff(dayjs(), 'day');
            expect(proInterval).toBeLessThanOrEqual(180);
        });

        it('should apply streak bonuses correctly', () => {
            const baseSession = {
                voiceEnabled: false,
                performance: {
                    averageConfidence: 0.9
                }
            };

            // Test with no streak
            const noStreakReview = fsrs.calculateNextReview(
                mockCard, 
                4, 
                'pro',
                { ...baseSession, performance: { ...baseSession.performance, studyStreak: 1 } }
            );

            // Test with 14-day streak (1.2x multiplier)
            const streakReview = fsrs.calculateNextReview(
                mockCard,
                4,
                'pro',
                { ...baseSession, performance: { ...baseSession.performance, studyStreak: 14 } }
            );

            const noStreakInterval = dayjs(noStreakReview).diff(dayjs(), 'hour');
            const streakInterval = dayjs(streakReview).diff(dayjs(), 'hour');

            expect(streakInterval).toBeGreaterThan(noStreakInterval);
            expect(streakInterval / noStreakInterval).toBeCloseTo(1.2, 1);
        });
    });

    describe('voiceConfidenceImpact', () => {
        it('should boost intervals for high voice confidence', () => {
            const session = {
                voiceEnabled: true,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.95
                }
            };

            const voiceNextReview = fsrs.calculateNextReview(mockCard, 4, 'pro', session);
            
            // Compare with non-voice mode
            const standardNextReview = fsrs.calculateNextReview(mockCard, 4, 'pro', {
                ...session,
                voiceEnabled: false
            });

            const voiceInterval = dayjs(voiceNextReview).diff(dayjs(), 'hour');
            const standardInterval = dayjs(standardNextReview).diff(dayjs(), 'hour');

            expect(voiceInterval).toBeGreaterThan(standardInterval);
            expect(voiceInterval / standardInterval).toBeCloseTo(1.2, 1); // Voice multiplier
        });

        it('should handle low voice confidence appropriately', () => {
            const session = {
                voiceEnabled: true,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.7
                }
            };

            const nextReview = fsrs.calculateNextReview(mockCard, 4, 'pro', session);
            const interval = dayjs(nextReview).diff(dayjs(), 'hour');

            expect(interval).toBeGreaterThanOrEqual(4); // Minimum interval
            expect(interval).toBeLessThan(24); // Reduced due to low confidence
        });
    });

    describe('updateCardFSRSData', () => {
        it('should track retention rate accurately', () => {
            const session = {
                voiceEnabled: false,
                performance: {
                    studyStreak: 7,
                    averageConfidence: 0.9
                }
            };

            const updatedData = fsrs.updateCardFSRSData(mockCard, 4, session);

            expect(updatedData.retentionRate).toBeDefined();
            expect(updatedData.retentionRate).toBeGreaterThanOrEqual(0.85);
            expect(updatedData.retentionRate).toBeLessThanOrEqual(1.0);
        });

        it('should maintain voice confidence history', () => {
            const session = {
                voiceEnabled: true,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.9
                }
            };

            const updatedData = fsrs.updateCardFSRSData(mockCard, 4, session);

            expect(updatedData.voiceConfidenceHistory).toBeDefined();
            expect(updatedData.voiceConfidenceHistory.length).toBeGreaterThan(0);
            expect(updatedData.voiceConfidenceHistory).toContain(0.9);
        });
    });

    describe('retentionOptimization', () => {
        it('should maintain minimum 85% retention rate', () => {
            const sessions = Array.from({ length: 10 }, (_, i) => ({
                voiceEnabled: false,
                performance: {
                    studyStreak: i + 1,
                    averageConfidence: 0.9
                }
            }));

            let retentionRates = [];
            for (const session of sessions) {
                const updatedData = fsrs.updateCardFSRSData(mockCard, 4, session);
                retentionRates.push(updatedData.retentionRate);
            }

            const averageRetention = retentionRates.reduce((a, b) => a + b, 0) / retentionRates.length;
            expect(averageRetention).toBeGreaterThanOrEqual(0.85);
        });

        it('should balance retention vs interval length', () => {
            const session = {
                voiceEnabled: false,
                performance: {
                    studyStreak: 1,
                    averageConfidence: 0.9
                }
            };

            // Test with different ratings
            const ratings = [2, 3, 4, 5];
            const intervals = ratings.map(rating => {
                const nextReview = fsrs.calculateNextReview(mockCard, rating, 'pro', session);
                return dayjs(nextReview).diff(dayjs(), 'hour');
            });

            // Verify intervals increase with rating while maintaining retention
            for (let i = 1; i < intervals.length; i++) {
                expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
            }
        });
    });
});