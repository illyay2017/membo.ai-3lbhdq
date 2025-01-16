import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { waitFor } from '@testing-library/react';
import now from 'performance-now';
import { StudyService } from '../../src/services/studyService';
import { generateMockCard } from '../utils/testHelpers';
import { CONFIDENCE_LEVELS, STUDY_MODES, FSRS_CONFIG } from '../../src/constants/study';
import { VoiceRecognitionState } from '../../src/types/voice';
import { Card } from '../../src/types/card';

describe('StudyService', () => {
    let studyService: StudyService;
    let apiSpy: jest.SpyInstance;
    let wsSpy: jest.SpyInstance;
    let voiceSpy: jest.SpyInstance;
    let mockCards: Card[];

    beforeEach(async () => {
        // Initialize test environment
        const mockAuthToken = 'test-auth-token';
        studyService = new StudyService(mockAuthToken);

        // Setup mock cards
        mockCards = Array.from({ length: 5 }, () => generateMockCard());

        // Setup API mocks
        apiSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
            const start = now();
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
            const duration = now() - start;

            if (url.includes('/api/v1/study/session')) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'test-session-id',
                        cards: mockCards,
                        performance: {
                            totalCards: 0,
                            correctCount: 0,
                            incorrectCount: 0,
                            averageConfidence: 0,
                            studyStreak: 0,
                            timeSpent: 0,
                            fsrsProgress: {
                                averageStability: FSRS_CONFIG.retentionOptimization.minimumStability,
                                averageDifficulty: 1.0,
                                retentionRate: 0,
                                stabilityGrowthRate: 1.0,
                                difficultyGrowthRate: 1.0
                            }
                        },
                        duration
                    })
                } as Response;
            }
            return { ok: true, json: async () => ({}) } as Response;
        });

        // Setup WebSocket mocks
        wsSpy = jest.spyOn(WebSocket.prototype, 'send');

        // Setup Voice Service mocks
        voiceSpy = jest.spyOn(window, 'SpeechRecognition').mockImplementation(() => ({
            start: jest.fn(),
            stop: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
        studyService = null!;
    });

    describe('Study Session Management', () => {
        it('should initialize study session with correct configuration', async () => {
            const sessionSettings = {
                sessionDuration: 1800,
                cardsPerSession: 20,
                voiceEnabled: false
            };

            const session = await studyService.startStudySession(sessionSettings);

            expect(session).toBeDefined();
            expect(session.id).toBe('test-session-id');
            expect(apiSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/study/session'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"sessionDuration":1800')
                })
            );
        });

        it('should properly end study session and calculate metrics', async () => {
            await studyService.startStudySession();
            const endedSession = await studyService.endStudySession();

            expect(endedSession).toBeDefined();
            expect(apiSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/study/session'),
                expect.objectContaining({ method: 'PUT' })
            );
            expect(wsSpy).toHaveBeenCalledWith(
                expect.stringContaining('SESSION_END')
            );
        });
    });

    describe('FSRS Algorithm Implementation', () => {
        it('should calculate correct FSRS progress after card review', async () => {
            await studyService.startStudySession();
            const mockCard = mockCards[0];

            await studyService.submitCardReview(
                mockCard.id,
                CONFIDENCE_LEVELS.GOOD
            );

            const nextCard = await studyService.getNextCard();
            expect(nextCard.fsrsData.stability).toBeGreaterThan(
                mockCard.fsrsData.stability
            );
            expect(apiSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/study/review'),
                expect.any(Object)
            );
        });

        it('should maintain target retention rate over multiple reviews', async () => {
            await studyService.startStudySession();
            
            // Simulate multiple card reviews
            for (const card of mockCards) {
                await studyService.submitCardReview(
                    card.id,
                    CONFIDENCE_LEVELS.GOOD
                );
            }

            const session = await studyService.endStudySession();
            expect(session.performance.retentionRate).toBeGreaterThanOrEqual(
                FSRS_CONFIG.retentionOptimization.targetRetention
            );
        });
    });

    describe('Voice-Enabled Study Mode', () => {
        it('should properly initialize voice mode', async () => {
            const session = await studyService.startStudySession({
                voiceEnabled: true,
                voiceLanguage: 'en-US'
            });

            expect(session.settings.voiceEnabled).toBe(true);
            expect(voiceSpy).toHaveBeenCalled();
        });

        it('should process voice input with confidence threshold', async () => {
            await studyService.startStudySession({ voiceEnabled: true });
            const mockCard = mockCards[0];

            const voiceData = {
                transcript: 'test answer',
                confidence: 0.9
            };

            await studyService.submitCardReview(
                mockCard.id,
                CONFIDENCE_LEVELS.GOOD,
                voiceData
            );

            expect(apiSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/study/review'),
                expect.objectContaining({
                    body: expect.stringContaining('"voiceData"')
                })
            );
        });
    });

    describe('Performance Metrics', () => {
        it('should meet API response time SLA requirements', async () => {
            const start = now();
            await studyService.startStudySession();
            const duration = now() - start;

            expect(duration).toBeLessThan(200); // 200ms SLA requirement
        });

        it('should maintain study streak for consistent usage', async () => {
            // Simulate 14 days of study sessions
            const sessions = [];
            for (let i = 0; i < 14; i++) {
                const session = await studyService.startStudySession();
                await studyService.submitCardReview(
                    mockCards[0].id,
                    CONFIDENCE_LEVELS.GOOD
                );
                sessions.push(await studyService.endStudySession());
            }

            const lastSession = sessions[sessions.length - 1];
            expect(lastSession.performance.studyStreak).toBeGreaterThanOrEqual(14);
        });

        it('should track and report comprehensive performance metrics', async () => {
            await studyService.startStudySession();

            // Simulate mixed performance reviews
            await studyService.submitCardReview(
                mockCards[0].id,
                CONFIDENCE_LEVELS.GOOD
            );
            await studyService.submitCardReview(
                mockCards[1].id,
                CONFIDENCE_LEVELS.AGAIN
            );

            const session = await studyService.endStudySession();
            
            expect(session.performance).toEqual(
                expect.objectContaining({
                    totalCards: expect.any(Number),
                    correctCount: expect.any(Number),
                    incorrectCount: expect.any(Number),
                    averageConfidence: expect.any(Number),
                    studyStreak: expect.any(Number),
                    timeSpent: expect.any(Number),
                    fsrsProgress: expect.any(Object),
                    retentionRate: expect.any(Number)
                })
            );
        });
    });
});