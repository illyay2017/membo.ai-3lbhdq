import { jest } from '@jest/globals';
import { StudySessionManager } from '../../src/core/study/studySessionManager';
import { FSRSAlgorithm } from '../../src/core/study/FSRSAlgorithm';
import { CardScheduler } from '../../src/core/study/cardScheduler';
import { createMockStudySession } from '../utils/testHelpers';
import { StudyModes } from '../../src/constants/studyModes';

// Mock dependencies
jest.mock('../../src/core/study/FSRSAlgorithm');
jest.mock('../../src/core/study/cardScheduler');
jest.mock('../../src/core/study/performanceAnalyzer');

describe('StudySessionManager', () => {
    let studySessionManager: StudySessionManager;
    let mockFSRSAlgorithm: jest.Mocked<FSRSAlgorithm>;
    let mockCardScheduler: jest.Mocked<CardScheduler>;
    let mockDate: jest.SpyInstance;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Initialize mocked dependencies
        mockFSRSAlgorithm = new FSRSAlgorithm() as jest.Mocked<FSRSAlgorithm>;
        mockCardScheduler = new CardScheduler(
            mockFSRSAlgorithm,
            null,
            0.85,
            14
        ) as jest.Mocked<CardScheduler>;

        // Mock current date for consistent testing
        mockDate = jest.spyOn(global, 'Date').mockImplementation(() => 
            new Date('2024-01-01T12:00:00Z')
        );

        // Initialize StudySessionManager with mocked dependencies
        studySessionManager = new StudySessionManager(
            mockFSRSAlgorithm,
            mockCardScheduler,
            null
        );
    });

    afterEach(() => {
        mockDate.mockRestore();
        jest.clearAllMocks();
    });

    describe('Session Creation', () => {
        it('should create a standard study session with correct initialization', async () => {
            const userId = 'test-user';
            const mode = StudyModes.STANDARD;
            const settings = { enableFSRS: true };

            mockCardScheduler.calculateOptimalBatchSize.mockResolvedValue(20);
            mockCardScheduler.getNextDueCards.mockResolvedValue([]);

            const session = await studySessionManager.createSession(userId, mode, settings);

            expect(session).toMatchObject({
                userId,
                mode,
                settings,
                voiceEnabled: false,
                status: 'active',
                performance: {
                    totalCards: 0,
                    correctCount: 0,
                    averageConfidence: 1.0,
                    studyStreak: 0
                }
            });
            expect(mockCardScheduler.calculateOptimalBatchSize).toHaveBeenCalledWith(userId, mode);
        });

        it('should create a voice-enabled session with proper configuration', async () => {
            const userId = 'test-user';
            const mode = StudyModes.VOICE;
            const settings = { voiceConfig: { recognitionThreshold: 0.85 } };

            mockCardScheduler.calculateOptimalBatchSize.mockResolvedValue(15);
            mockCardScheduler.getNextDueCards.mockResolvedValue([]);

            const session = await studySessionManager.createSession(userId, mode, settings);

            expect(session.voiceEnabled).toBe(true);
            expect(session.settings.voiceConfig.recognitionThreshold).toBe(0.85);
        });
    });

    describe('Card Review Processing', () => {
        it('should process card review with FSRS algorithm integration', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                mode: StudyModes.STANDARD
            });

            // Set up session
            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            mockCardScheduler.processReview.mockResolvedValue({
                id: 'test-card',
                fsrsData: { stability: 0.8, difficulty: 0.3 }
            });

            const result = await studySessionManager.processCardReview(
                mockSession.id,
                'test-card',
                4
            );

            expect(result).toHaveProperty('session');
            expect(result).toHaveProperty('nextCard');
            expect(mockCardScheduler.processReview).toHaveBeenCalledWith(
                'test-card',
                4,
                false
            );
        });

        it('should handle voice mode confidence in review processing', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                mode: StudyModes.VOICE,
                voiceEnabled: true
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const result = await studySessionManager.processCardReview(
                mockSession.id,
                'test-card',
                3
            );

            expect(result.session.performance.averageConfidence).toBeLessThanOrEqual(1.0);
        });
    });

    describe('Session State Management', () => {
        it('should pause session while preserving state', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                status: 'active'
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const pausedSession = await studySessionManager.pauseSession(mockSession.id);

            expect(pausedSession.status).toBe('paused');
            expect(pausedSession.performance).toBeDefined();
        });

        it('should resume session with state restoration', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                status: 'paused'
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const resumedSession = await studySessionManager.resumeSession(mockSession.id);

            expect(resumedSession.status).toBe('active');
            expect(resumedSession.performance).toBeDefined();
        });

        it('should complete session with comprehensive analytics', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                status: 'active'
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const result = await studySessionManager.completeSession(mockSession.id);

            expect(result).toHaveProperty('session');
            expect(result).toHaveProperty('streakAnalysis');
            expect(result).toHaveProperty('performanceReport');
            expect(result.session.status).toBe('completed');
        });
    });

    describe('Performance Analytics', () => {
        it('should track retention rate above target threshold', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                performance: {
                    correctCount: 18,
                    totalCards: 20,
                    averageConfidence: 0.9
                }
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const sessionState = await studySessionManager.getSessionState(mockSession.id);

            expect(sessionState.performance.fsrsProgress.retentionRate).toBeGreaterThanOrEqual(0.85);
        });

        it('should maintain study streak for consistent performance', async () => {
            const mockSession = createMockStudySession({
                id: 'test-session',
                performance: {
                    studyStreak: 14,
                    correctCount: 45,
                    totalCards: 50
                }
            });

            (studySessionManager as any).activeSessions.set(mockSession.id, mockSession);

            const result = await studySessionManager.completeSession(mockSession.id);

            expect(result.streakAnalysis.currentStreak).toBeGreaterThanOrEqual(14);
        });
    });
});