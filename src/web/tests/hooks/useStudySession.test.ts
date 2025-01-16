/**
 * @fileoverview Comprehensive test suite for useStudySession hook
 * Tests study session management, voice interactions, and FSRS algorithm integration
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { useStudySession } from '../../src/hooks/useStudySession';
import { studyService } from '../../src/services/studyService';
import { generateMockCard } from '../utils/testHelpers';
import { VoiceRecognitionState } from '../../src/types/voice';
import { STUDY_MODES, CONFIDENCE_LEVELS } from '../../src/constants/study';

// Mock studyService
jest.mock('../../src/services/studyService', () => ({
  startStudySession: jest.fn(),
  submitCardResponse: jest.fn(),
  processVoiceResponse: jest.fn(),
  endStudySession: jest.fn(),
  syncOfflineResponses: jest.fn()
}));

describe('useStudySession', () => {
  // Test data setup
  const mockCard = generateMockCard();
  const defaultSettings = {
    sessionDuration: 1800,
    cardsPerSession: 20,
    showConfidenceButtons: true,
    enableFSRS: true,
    voiceEnabled: false,
    voiceConfidenceThreshold: 0.85,
    voiceLanguage: 'en-US',
    fsrsParameters: {
      stabilityThreshold: 0.7,
      difficultyThreshold: 0.8,
      retentionTarget: 0.85,
      learningRate: 0.1
    }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    localStorage.clear();

    // Reset studyService mock implementations
    (studyService.startStudySession as jest.Mock).mockResolvedValue({
      id: 'test-session',
      cards: [mockCard]
    });
    (studyService.submitCardResponse as jest.Mock).mockResolvedValue(undefined);
    (studyService.processVoiceResponse as jest.Mock).mockResolvedValue({
      correct: true,
      confidence: 0.9
    });
  });

  describe('Session Management', () => {
    it('should initialize session with default settings', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(defaultSettings);
      });

      expect(result.current.session).toBeTruthy();
      expect(result.current.currentCard).toBe(mockCard);
      expect(studyService.startStudySession).toHaveBeenCalledWith(defaultSettings);
    });

    it('should track study performance metrics', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(defaultSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(result.current.performance.totalCards).toBe(1);
      expect(result.current.performance.correctCount).toBe(1);
      expect(result.current.performance.averageConfidence).toBeGreaterThan(0);
    });

    it('should maintain study streak', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(defaultSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(result.current.studyStreak).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Voice Interaction', () => {
    const voiceSettings = {
      ...defaultSettings,
      voiceEnabled: true
    };

    it('should initialize voice mode correctly', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(voiceSettings);
      });

      expect(result.current.voiceMode.enabled).toBe(true);
      expect(result.current.voiceMode.state).toBe(VoiceRecognitionState.LISTENING);
    });

    it('should process voice responses with confidence validation', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(voiceSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(studyService.processVoiceResponse).toHaveBeenCalled();
      expect(result.current.performance.correctCount).toBe(1);
    });

    it('should handle voice recognition errors gracefully', async () => {
      const { result } = renderHook(() => useStudySession());
      (studyService.processVoiceResponse as jest.Mock).mockRejectedValueOnce(new Error('Voice error'));

      await act(async () => {
        await result.current.startSession(voiceSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.voiceMode.state).toBe(VoiceRecognitionState.ERROR);
    });
  });

  describe('Offline Support', () => {
    it('should store responses offline when disconnected', async () => {
      const { result } = renderHook(() => useStudySession());
      (studyService.submitCardResponse as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.startSession(defaultSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(result.current.offlineMode).toBe(true);
      expect(result.current.syncStatus.pendingSync).toBe(true);
    });

    it('should sync offline responses when reconnected', async () => {
      const { result } = renderHook(() => useStudySession());

      // Simulate offline mode
      await act(async () => {
        await result.current.startSession(defaultSettings);
        result.current.setOfflineMode(true);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      // Simulate reconnection
      await act(async () => {
        result.current.setOfflineMode(false);
        await result.current.forceSync();
      });

      expect(studyService.syncOfflineResponses).toHaveBeenCalled();
      expect(result.current.syncStatus.pendingSync).toBe(false);
    });
  });

  describe('FSRS Algorithm Integration', () => {
    it('should apply FSRS parameters to review submissions', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(defaultSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(studyService.submitCardResponse).toHaveBeenCalledWith(
        expect.any(String),
        CONFIDENCE_LEVELS.GOOD,
        expect.objectContaining({
          fsrsProgress: expect.any(Object)
        })
      );
    });

    it('should track retention rate above target threshold', async () => {
      const { result } = renderHook(() => useStudySession());

      await act(async () => {
        await result.current.startSession(defaultSettings);
        // Submit multiple good reviews
        for (let i = 0; i < 5; i++) {
          await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
        }
      });

      expect(result.current.performance.retentionRate).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Error Handling', () => {
    it('should handle session initialization errors', async () => {
      const { result } = renderHook(() => useStudySession());
      (studyService.startStudySession as jest.Mock).mockRejectedValueOnce(new Error('Init error'));

      await act(async () => {
        await result.current.startSession(defaultSettings);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.session).toBeNull();
    });

    it('should retry failed operations with backoff', async () => {
      const { result } = renderHook(() => useStudySession());
      (studyService.submitCardResponse as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.startSession(defaultSettings);
        await result.current.submitReview(CONFIDENCE_LEVELS.GOOD);
      });

      expect(studyService.submitCardResponse).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();
    });
  });
});