/**
 * @fileoverview Integration tests for membo.ai study functionality including
 * study session management, FSRS algorithm, voice mode, and performance tracking.
 * @version 1.0.0
 */

import { StudyService } from '../../src/services/StudyService';
import { StudyModes } from '../../src/constants/studyModes';
import { 
    createMockUser, 
    createMockVoiceData, 
    setupTestDatabase, 
    mockVoiceService 
} from '../utils/testHelpers';
import { UserRole } from '../../src/constants/userRoles';
import { jest } from '@jest/globals';
import supertest from 'supertest';

describe('Study Service Integration Tests', () => {
    let studyService: StudyService;
    let mockUsers: { free: any; pro: any; power: any };
    let mockVoiceService: jest.Mock;

    beforeAll(async () => {
        // Initialize test environment
        await setupTestDatabase();
        mockVoiceService = jest.fn();

        // Create mock users with different tiers
        mockUsers = {
            free: createMockUser({ role: UserRole.FREE_USER }),
            pro: createMockUser({ role: UserRole.PRO_USER }),
            power: createMockUser({ role: UserRole.POWER_USER })
        };

        // Initialize study service with mocked dependencies
        studyService = new StudyService(
            mockVoiceService,
            { retentionTarget: 0.85, minStreakDays: 14 }
        );
    });

    afterAll(async () => {
        // Clean up test environment
        await jest.clearAllMocks();
        mockVoiceService.mockReset();
    });

    describe('Voice Mode Integration', () => {
        it('should initialize voice recognition service correctly', async () => {
            const session = await studyService.startStudySession(
                mockUsers.pro.id,
                StudyModes.VOICE,
                { voiceEnabled: true }
            );

            expect(session.voiceEnabled).toBe(true);
            expect(session.settings.voiceConfig.recognitionThreshold).toBe(0.85);
            expect(mockVoiceService).toHaveBeenCalledTimes(1);
        });

        it('should process voice responses with confidence scoring', async () => {
            const session = await studyService.startStudySession(
                mockUsers.pro.id,
                StudyModes.VOICE,
                { voiceEnabled: true }
            );

            const voiceData = {
                confidence: 0.92,
                transcript: 'Test answer'
            };

            const result = await studyService.submitCardReview(
                session.id,
                'card-123',
                3,
                voiceData
            );

            expect(result.enhancedMetrics.voiceConfidence).toBe(0.92);
            expect(result.enhancedMetrics.streakImpact).toBe('maintained');
        });

        it('should enforce tier restrictions for voice mode', async () => {
            await expect(
                studyService.startStudySession(
                    mockUsers.free.id,
                    StudyModes.VOICE,
                    { voiceEnabled: true }
                )
            ).rejects.toThrow('Voice mode not available for free tier');
        });

        it('should handle voice service interruptions gracefully', async () => {
            mockVoiceService.mockImplementationOnce(() => {
                throw new Error('Voice service unavailable');
            });

            const session = await studyService.startStudySession(
                mockUsers.pro.id,
                StudyModes.VOICE,
                { voiceEnabled: true }
            );

            const result = await studyService.submitCardReview(
                session.id,
                'card-123',
                3
            );

            expect(result.enhancedMetrics.voiceEnabled).toBe(false);
            expect(result.enhancedMetrics.fallbackMode).toBe('standard');
        });

        it('should calculate confidence scores accurately from voice input', async () => {
            const session = await studyService.startStudySession(
                mockUsers.power.id,
                StudyModes.VOICE,
                { voiceEnabled: true }
            );

            const voiceResponses = [
                { confidence: 0.95, transcript: 'Perfect answer' },
                { confidence: 0.75, transcript: 'Partial answer' },
                { confidence: 0.60, transcript: 'Poor answer' }
            ];

            for (const response of voiceResponses) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    3,
                    response
                );

                expect(result.enhancedMetrics.voiceConfidence).toBe(response.confidence);
                expect(result.enhancedMetrics.adjustedRating).toBeDefined();
            }
        });
    });

    describe('Performance Tracking', () => {
        it('should calculate retention rate accurately', async () => {
            const session = await studyService.startStudySession(
                mockUsers.pro.id,
                StudyModes.STANDARD,
                {}
            );

            // Submit multiple reviews to calculate retention
            const reviews = [
                { rating: 4, expected: 1.0 },
                { rating: 3, expected: 0.9 },
                { rating: 2, expected: 0.7 },
                { rating: 1, expected: 0.5 }
            ];

            for (const review of reviews) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    review.rating
                );

                expect(result.enhancedMetrics.retentionRate).toBeCloseTo(
                    review.expected,
                    1
                );
            }
        });

        it('should maintain study streaks correctly', async () => {
            const session = await studyService.startStudySession(
                mockUsers.power.id,
                StudyModes.STANDARD,
                {}
            );

            // Simulate daily reviews for streak calculation
            const dailyReviews = Array(15).fill({ rating: 4 });

            for (const review of dailyReviews) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    review.rating
                );

                expect(result.enhancedMetrics.streakMaintained).toBe(true);
                expect(result.enhancedMetrics.currentStreak).toBeGreaterThan(0);
            }
        });

        it('should track tier-specific performance metrics', async () => {
            const sessions = await Promise.all([
                studyService.startStudySession(mockUsers.free.id, StudyModes.STANDARD, {}),
                studyService.startStudySession(mockUsers.pro.id, StudyModes.STANDARD, {}),
                studyService.startStudySession(mockUsers.power.id, StudyModes.STANDARD, {})
            ]);

            for (const session of sessions) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    4
                );

                expect(result.enhancedMetrics.tierSpecific).toBeDefined();
                expect(result.enhancedMetrics.maxInterval).toBeDefined();
            }
        });

        it('should validate retention rate thresholds', async () => {
            const session = await studyService.startStudySession(
                mockUsers.pro.id,
                StudyModes.STANDARD,
                {}
            );

            // Submit reviews to test retention threshold
            const reviews = Array(10).fill({ rating: 2 }); // Consistently low ratings

            for (const review of reviews) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    review.rating
                );

                expect(result.enhancedMetrics.retentionRate).toBeLessThan(0.85);
                expect(result.enhancedMetrics.recommendedActions).toBeDefined();
            }
        });

        it('should handle streak interruptions appropriately', async () => {
            const session = await studyService.startStudySession(
                mockUsers.power.id,
                StudyModes.STANDARD,
                {}
            );

            // Simulate streak interruption
            const reviews = [
                ...Array(5).fill({ rating: 4 }), // Good streak
                { rating: 1 }, // Interruption
                ...Array(3).fill({ rating: 4 }) // Recovery
            ];

            for (const review of reviews) {
                const result = await studyService.submitCardReview(
                    session.id,
                    'card-123',
                    review.rating
                );

                if (review.rating === 1) {
                    expect(result.enhancedMetrics.streakImpact).toBe('reset');
                    expect(result.enhancedMetrics.recoveryPlan).toBeDefined();
                }
            }
        });
    });
});