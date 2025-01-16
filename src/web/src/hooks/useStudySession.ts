/**
 * @fileoverview Custom React hook for managing study session state and interactions
 * Implements voice-enabled study capabilities, offline support, and FSRS algorithm integration
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { StudySession, StudyPerformance, StudySessionSettings } from '../types/study';
import { studyService } from '../services/studyService';
import { useStudyStore } from '../store/studyStore';

/**
 * Enhanced study session hook with comprehensive state management
 * @param initialSettings Initial study session settings
 */
export const useStudySession = (initialSettings?: Partial<StudySessionSettings>) => {
    // Local state for enhanced error handling and loading states
    const [isInitializing, setIsInitializing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [lastError, setLastError] = useState<Error | null>(null);

    // Connect to global study store
    const {
        currentSession,
        currentCard,
        isLoading,
        error,
        studyStreak,
        performance,
        voiceMode,
        syncStatus,
        offlineMode,
        startSession,
        endSession,
        submitReview,
        toggleVoiceMode,
        loadNextCard,
        updatePerformance,
        syncWithServer,
        setOfflineMode
    } = useStudyStore();

    /**
     * Initialize study session with enhanced error handling
     */
    const initializeSession = useCallback(async (settings: Partial<StudySessionSettings> = {}) => {
        setIsInitializing(true);
        try {
            const mergedSettings: StudySessionSettings = {
                sessionDuration: 1800, // 30 minutes
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
                },
                ...initialSettings,
                ...settings
            };

            await startSession(mergedSettings);
            setRetryCount(0);
        } catch (error) {
            setLastError(error as Error);
            if (retryCount < 3) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => initializeSession(settings), 1000 * Math.pow(2, retryCount));
            }
        } finally {
            setIsInitializing(false);
        }
    }, [startSession, initialSettings, retryCount]);

    /**
     * Submit card review with enhanced offline support
     */
    const handleSubmitReview = useCallback(async (
        confidence: number,
        voiceData?: { transcript: string; confidence: number }
    ) => {
        try {
            if (!currentCard) return;

            // Update local performance metrics immediately
            const updatedPerformance: Partial<StudyPerformance> = {
                totalCards: performance.totalCards + 1,
                correctCount: confidence >= 3 ? performance.correctCount + 1 : performance.correctCount,
                incorrectCount: confidence < 3 ? performance.incorrectCount + 1 : performance.incorrectCount,
                averageConfidence: (
                    (performance.averageConfidence * performance.totalCards + confidence) /
                    (performance.totalCards + 1)
                )
            };
            updatePerformance(updatedPerformance);

            // Submit review with offline support
            await submitReview(confidence);

            if (navigator.onLine && syncStatus.pendingSync) {
                await syncWithServer();
            }
        } catch (error) {
            setLastError(error as Error);
            if (!offlineMode) {
                setOfflineMode(true);
            }
        }
    }, [currentCard, performance, submitReview, syncWithServer, offlineMode, setOfflineMode, updatePerformance]);

    /**
     * Handle voice-enabled study mode
     */
    const handleVoiceMode = useCallback(async () => {
        try {
            await toggleVoiceMode();
        } catch (error) {
            setLastError(error as Error);
            // Fallback to non-voice mode
            if (voiceMode.enabled) {
                await toggleVoiceMode();
            }
        }
    }, [toggleVoiceMode, voiceMode.enabled]);

    /**
     * Clean up study session resources
     */
    const cleanupSession = useCallback(async () => {
        try {
            if (currentSession) {
                // Ensure offline data is synced before ending
                if (navigator.onLine && syncStatus.pendingSync) {
                    await syncWithServer();
                }
                await endSession();
            }
        } catch (error) {
            setLastError(error as Error);
        }
    }, [currentSession, endSession, syncWithServer, syncStatus.pendingSync]);

    // Setup automatic retry for offline operations
    useEffect(() => {
        let syncInterval: NodeJS.Timer;
        
        if (offlineMode && navigator.onLine) {
            syncInterval = setInterval(async () => {
                try {
                    await syncWithServer();
                    if (!syncStatus.pendingSync) {
                        setOfflineMode(false);
                        clearInterval(syncInterval);
                    }
                } catch (error) {
                    setLastError(error as Error);
                }
            }, 30000); // Retry every 30 seconds
        }

        return () => {
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
    }, [offlineMode, syncWithServer, syncStatus.pendingSync, setOfflineMode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupSession();
        };
    }, [cleanupSession]);

    return {
        // Session state
        session: currentSession,
        currentCard,
        isLoading: isLoading || isInitializing,
        error: error || lastError?.message,
        studyStreak,
        performance,
        
        // Voice mode state
        voiceMode,
        
        // Offline state
        offlineMode,
        syncStatus,
        
        // Actions
        startSession: initializeSession,
        submitReview: handleSubmitReview,
        toggleVoiceMode: handleVoiceMode,
        endSession: cleanupSession,
        loadNextCard,
        
        // Utilities
        retry: () => initializeSession(initialSettings),
        clearError: () => setLastError(null),
        forceSync: syncWithServer
    };
};