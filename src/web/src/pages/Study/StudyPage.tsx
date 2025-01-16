/**
 * Main study page component orchestrating the study session experience
 * Implements voice-enabled study capabilities, offline support, and FSRS algorithm
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import CardDisplay from '../../components/study/CardDisplay';
import VoiceControls from '../../components/study/VoiceControls';
import ConfidenceButtons from '../../components/study/ConfidenceButtons';
import { useStudySession } from '../../hooks/useStudySession';
import { useWebSocket } from '../../hooks/useWebSocket';
import { usePerformanceMonitor } from '@membo/performance-monitor'; // v1.0.0
import { STUDY_MODES, STUDY_MODE_CONFIG } from '../../constants/study';
import { colors } from '../../constants/theme';

// Study page props interface
interface StudyPageProps {
  mode?: STUDY_MODES;
  settings?: {
    sessionDuration?: number;
    cardsPerSession?: number;
    voiceEnabled?: boolean;
    voiceConfidenceThreshold?: number;
    voiceLanguage?: string;
  };
  onSessionComplete?: () => void;
  onError?: (error: Error) => void;
}

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="flex flex-col items-center justify-center p-6 space-y-4">
    <h2 className="text-xl font-semibold text-error">Study Session Error</h2>
    <p className="text-secondary">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className={`px-4 py-2 rounded bg-[${colors.primary}] text-white`}
    >
      Retry Session
    </button>
  </div>
);

/**
 * StudyPage component implementing comprehensive study session management
 */
const StudyPage: React.FC<StudyPageProps> = ({
  mode = STUDY_MODES.STANDARD,
  settings = {},
  onSessionComplete,
  onError
}) => {
  // Initialize hooks
  const {
    session,
    currentCard,
    isLoading,
    error,
    studyStreak,
    performance,
    voiceMode,
    offlineMode,
    syncStatus,
    startSession,
    submitReview,
    toggleVoiceMode,
    endSession,
    loadNextCard,
    retry,
    clearError,
    forceSync
  } = useStudySession();

  const { connection } = useWebSocket(session?.id || '');
  const { trackMetric } = usePerformanceMonitor();

  // Local state
  const [showConfidence, setShowConfidence] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ current: 0, total: 0 });

  /**
   * Initialize study session with configuration
   */
  useEffect(() => {
    const initSession = async () => {
      try {
        const modeConfig = STUDY_MODE_CONFIG[mode];
        await startSession({
          sessionDuration: settings.sessionDuration || modeConfig.sessionDuration,
          cardsPerSession: settings.cardsPerSession || modeConfig.maxCardsPerSession,
          voiceEnabled: settings.voiceEnabled || mode === STUDY_MODES.VOICE,
          voiceConfidenceThreshold: settings.voiceConfidenceThreshold || modeConfig.voiceConfidenceThreshold,
          voiceLanguage: settings.voiceLanguage || 'en-US',
          showConfidenceButtons: modeConfig.showConfidenceButtons,
          enableFSRS: modeConfig.enableFSRS
        });

        setSessionProgress({
          current: 0,
          total: settings.cardsPerSession || modeConfig.maxCardsPerSession
        });
      } catch (error) {
        onError?.(error as Error);
      }
    };

    initSession();
  }, [mode, settings, startSession, onError]);

  /**
   * Handle card answer submission with performance tracking
   */
  const handleAnswer = useCallback(async (
    answer: string,
    confidence: number
  ) => {
    try {
      const startTime = performance.now();
      await submitReview(confidence, { transcript: answer, confidence });
      
      trackMetric('answerProcessingTime', performance.now() - startTime);
      setSessionProgress(prev => ({
        ...prev,
        current: prev.current + 1
      }));

      if (sessionProgress.current + 1 >= sessionProgress.total) {
        await endSession();
        onSessionComplete?.();
      } else {
        await loadNextCard();
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [submitReview, loadNextCard, endSession, onSessionComplete, onError, sessionProgress, trackMetric]);

  /**
   * Handle confidence rating submission
   */
  const handleConfidenceRating = useCallback(async (rating: number) => {
    try {
      await submitReview(rating);
      setShowConfidence(false);
      
      if (sessionProgress.current + 1 >= sessionProgress.total) {
        await endSession();
        onSessionComplete?.();
      } else {
        await loadNextCard();
        setSessionProgress(prev => ({
          ...prev,
          current: prev.current + 1
        }));
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [submitReview, loadNextCard, endSession, onSessionComplete, onError, sessionProgress]);

  /**
   * Handle voice mode toggle
   */
  const handleVoiceToggle = useCallback(async () => {
    try {
      await toggleVoiceMode();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [toggleVoiceMode, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={retry}
      onError={onError}
    >
      <div className="flex flex-col space-y-6 p-6">
        {/* Header with progress and stats */}
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-semibold">Study Session</h1>
            {offlineMode && (
              <span className="px-2 py-1 text-sm bg-warning/10 text-warning rounded">
                Offline Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-secondary">
              Streak: {studyStreak} days
            </span>
            <span className="text-sm text-secondary">
              Progress: {sessionProgress.current}/{sessionProgress.total}
            </span>
          </div>
        </header>

        {/* Main study area */}
        <main className="flex-1">
          {currentCard ? (
            <CardDisplay
              card={currentCard}
              isVoiceMode={voiceMode.enabled}
              onAnswer={handleAnswer}
              onConfidenceRating={handleConfidenceRating}
              onError={onError}
              className="max-w-3xl mx-auto"
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-secondary">No cards available for study</p>
            </div>
          )}
        </main>

        {/* Voice controls */}
        {mode === STUDY_MODES.VOICE && (
          <VoiceControls
            onVoiceStart={() => setShowConfidence(false)}
            onVoiceEnd={() => setShowConfidence(true)}
            onError={onError}
            disabled={isLoading || !currentCard}
            className="mx-auto"
          />
        )}

        {/* Study controls */}
        <footer className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleVoiceToggle}
              disabled={isLoading}
              className={`px-4 py-2 rounded ${
                voiceMode.enabled ? 'bg-primary' : 'bg-secondary'
              } text-white`}
            >
              {voiceMode.enabled ? 'Disable Voice' : 'Enable Voice'}
            </button>
            {offlineMode && (
              <button
                onClick={forceSync}
                disabled={!navigator.onLine}
                className="px-4 py-2 rounded bg-primary text-white"
              >
                Sync Now
              </button>
            )}
          </div>

          {/* Performance metrics */}
          <div className="text-sm text-secondary space-x-4">
            <span>Retention: {Math.round(performance.retentionRate * 100)}%</span>
            <span>Average Confidence: {Math.round(performance.averageConfidence * 100)}%</span>
          </div>
        </footer>

        {/* Error display */}
        {error && (
          <div
            className="fixed bottom-4 right-4 p-4 bg-error/10 text-error rounded shadow-lg"
            role="alert"
          >
            <p>{error}</p>
            <button
              onClick={clearError}
              className="mt-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default StudyPage;