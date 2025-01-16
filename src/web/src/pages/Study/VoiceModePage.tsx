/**
 * Voice-enabled study mode page component with enhanced error handling,
 * accessibility features, and performance monitoring.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CardDisplay from '../../components/study/CardDisplay';
import VoiceControls from '../../components/study/VoiceControls';
import { useStudySession } from '../../hooks/useStudySession';

// Constants for voice mode configuration
const VOICE_MODE_SETTINGS = {
  mode: 'voice',
  autoAdvance: true,
  confidenceThreshold: 0.85,
  maxRetries: 3,
  timeoutDuration: 5000,
  feedbackDelay: 500
} as const;

// Error messages for different scenarios
const ERROR_MESSAGES = {
  browserNotSupported: 'Voice recognition is not supported in your browser',
  noMicrophoneAccess: 'Microphone access is required for voice mode',
  lowConfidence: 'Could not understand clearly, please try again',
  networkError: 'Network error occurred during voice processing',
  sessionError: 'Failed to initialize study session'
} as const;

interface VoiceModePageProps {
  userRole: string;
  languagePreference: string;
  confidenceThreshold: number;
}

/**
 * Voice-enabled study mode page component
 */
const VoiceModePage: React.FC<VoiceModePageProps> = ({
  userRole,
  languagePreference,
  confidenceThreshold
}) => {
  const navigate = useNavigate();
  
  // Study session state management
  const {
    session,
    currentCard,
    isLoading,
    error,
    voiceMode,
    performance,
    startSession,
    submitReview,
    toggleVoiceMode,
    loadNextCard
  } = useStudySession();

  // Local state management
  const [processingVoice, setProcessingVoice] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  /**
   * Initialize study session with voice mode
   */
  useEffect(() => {
    const initializeVoiceSession = async () => {
      try {
        await startSession({
          ...VOICE_MODE_SETTINGS,
          voiceEnabled: true,
          voiceLanguage: languagePreference,
          voiceConfidenceThreshold: confidenceThreshold
        });
        setStartTime(Date.now());
      } catch (error) {
        setErrorMessage(ERROR_MESSAGES.sessionError);
        console.error('Failed to initialize voice session:', error);
      }
    };

    initializeVoiceSession();

    return () => {
      // Cleanup voice recognition on unmount
      if (voiceMode.enabled) {
        toggleVoiceMode();
      }
    };
  }, [startSession, languagePreference, confidenceThreshold]);

  /**
   * Handle voice recognition start
   */
  const handleVoiceStart = useCallback(async () => {
    try {
      setProcessingVoice(true);
      setErrorMessage(null);

      // Track performance metrics
      const startTimestamp = performance.now();
      
      await toggleVoiceMode();
      
      // Log voice start latency
      console.debug(`Voice start latency: ${performance.now() - startTimestamp}ms`);
    } catch (error) {
      setErrorMessage(ERROR_MESSAGES.noMicrophoneAccess);
      console.error('Voice start error:', error);
    }
  }, [toggleVoiceMode]);

  /**
   * Handle voice recognition end and process result
   */
  const handleVoiceEnd = useCallback(async (transcript: string, confidence: number) => {
    try {
      if (confidence < confidenceThreshold) {
        if (retryCount < VOICE_MODE_SETTINGS.maxRetries) {
          setRetryCount(prev => prev + 1);
          setErrorMessage(ERROR_MESSAGES.lowConfidence);
          return;
        }
      }

      // Process voice answer
      await submitReview(confidence, {
        transcript,
        confidence
      });

      setRetryCount(0);
      setErrorMessage(null);

      // Auto-advance to next card after delay
      if (VOICE_MODE_SETTINGS.autoAdvance) {
        setTimeout(async () => {
          await loadNextCard();
        }, VOICE_MODE_SETTINGS.feedbackDelay);
      }
    } catch (error) {
      setErrorMessage(ERROR_MESSAGES.networkError);
      console.error('Voice processing error:', error);
    } finally {
      setProcessingVoice(false);
    }
  }, [submitReview, loadNextCard, retryCount, confidenceThreshold]);

  /**
   * Handle voice recognition errors
   */
  const handleVoiceError = useCallback((error: Error) => {
    console.error('Voice error:', error);
    setErrorMessage(error.message);
    setProcessingVoice(false);
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header section */}
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Voice Study Mode</h1>
        <button
          onClick={() => navigate('/study')}
          className="text-secondary hover:text-primary transition-colors"
          aria-label="Exit voice study mode"
        >
          Exit
        </button>
      </header>

      {/* Error display */}
      {(error || errorMessage) && (
        <div 
          className="bg-error/10 text-error px-4 py-3 rounded-lg"
          role="alert"
        >
          {error || errorMessage}
        </div>
      )}

      {/* Study progress */}
      {session && (
        <div className="flex justify-between items-center text-sm text-secondary">
          <span>Cards studied: {performance.totalCards}</span>
          <span>Accuracy: {Math.round((performance.correctCount / performance.totalCards) * 100)}%</span>
          <span>
            Time: {Math.floor(((startTime ? Date.now() - startTime : 0) / 1000 / 60))}m
          </span>
        </div>
      )}

      {/* Main study area */}
      <main className="space-y-6">
        {currentCard && (
          <>
            <CardDisplay
              card={currentCard}
              isVoiceMode={voiceMode.enabled}
              onVoiceAnswer={handleVoiceEnd}
              className="max-w-2xl mx-auto"
            />

            <VoiceControls
              onVoiceStart={handleVoiceStart}
              onVoiceEnd={handleVoiceEnd}
              onError={handleVoiceError}
              disabled={processingVoice}
              confidenceThreshold={confidenceThreshold}
              retryAttempts={VOICE_MODE_SETTINGS.maxRetries}
              className="max-w-md mx-auto"
            />
          </>
        )}
      </main>

      {/* Study statistics */}
      <footer className="text-sm text-secondary space-y-2">
        <div className="flex justify-between">
          <span>Study streak: {performance.studyStreak} days</span>
          <span>Retention rate: {Math.round(performance.retentionRate * 100)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Average confidence: {Math.round(performance.averageConfidence * 100)}%</span>
          <span>Voice recognition rate: {Math.round((performance.correctCount / performance.totalCards) * 100)}%</span>
        </div>
      </footer>
    </div>
  );
};

export default VoiceModePage;