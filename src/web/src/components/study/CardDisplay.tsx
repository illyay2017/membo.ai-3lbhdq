/**
 * Enhanced card display component with voice mode and FSRS integration
 * Implements comprehensive study session features with accessibility support
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { cn } from '@/lib/utils';
import { Card } from '../../types/card';
import VoiceControls from './VoiceControls';
import ConfidenceButtons from './ConfidenceButtons';
import { useStudySession } from '../../hooks/useStudySession';

// Constants for voice recognition and card display
const VOICE_CONFIDENCE_THRESHOLD = 0.85;
const ANSWER_SIMILARITY_THRESHOLD = 0.8;
const VOICE_RETRY_ATTEMPTS = 3;

// Card display variants for visual feedback
const CARD_VARIANTS = {
  DEFAULT: 'bg-white dark:bg-gray-800',
  REVEALED: 'bg-gray-50 dark:bg-gray-700',
  CORRECT: 'bg-green-50 dark:bg-green-900',
  INCORRECT: 'bg-red-50 dark:bg-red-900',
  PROCESSING: 'bg-blue-50 dark:bg-blue-900'
} as const;

// Props interface for CardDisplay component
interface CardDisplayProps {
  card: Card;
  isVoiceMode?: boolean;
  onAnswer?: (answer: string, confidence: number) => void;
  onConfidenceRating?: (rating: number) => void;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * Enhanced card display component with voice mode and FSRS integration
 */
const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  isVoiceMode = false,
  onAnswer,
  onConfidenceRating,
  onError,
  className
}) => {
  // Local state management
  const [isRevealed, setIsRevealed] = useState(false);
  const [cardState, setCardState] = useState<keyof typeof CARD_VARIANTS>('DEFAULT');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [processingAnswer, setProcessingAnswer] = useState(false);

  // Hooks
  const { showBoundary } = useErrorBoundary();
  const {
    submitReview,
    voiceMode,
    isLoading,
    error: studyError
  } = useStudySession();

  /**
   * Handle voice transcript processing with confidence scoring
   */
  const handleVoiceTranscript = useCallback(async (
    transcript: string,
    confidence: number
  ) => {
    try {
      setProcessingAnswer(true);
      setVoiceTranscript(transcript);
      setCardState('PROCESSING');

      // Process voice answer if confidence meets threshold
      if (confidence >= VOICE_CONFIDENCE_THRESHOLD) {
        onAnswer?.(transcript, confidence);
        setIsRevealed(true);
        
        // Update card state based on answer similarity
        const similarity = calculateAnswerSimilarity(transcript, card.backContent.text);
        setCardState(similarity >= ANSWER_SIMILARITY_THRESHOLD ? 'CORRECT' : 'INCORRECT');
      }
    } catch (error) {
      onError?.(error as Error);
      showBoundary(error);
    } finally {
      setProcessingAnswer(false);
    }
  }, [card, onAnswer, onError, showBoundary]);

  /**
   * Handle confidence rating submission
   */
  const handleConfidenceRating = useCallback(async (rating: number) => {
    try {
      await submitReview(rating);
      onConfidenceRating?.(rating);
    } catch (error) {
      onError?.(error as Error);
      showBoundary(error);
    }
  }, [submitReview, onConfidenceRating, onError, showBoundary]);

  /**
   * Handle manual card reveal
   */
  const handleReveal = useCallback(() => {
    if (!isVoiceMode && !isRevealed && !processingAnswer) {
      setIsRevealed(true);
      setCardState('REVEALED');
    }
  }, [isVoiceMode, isRevealed, processingAnswer]);

  // Reset state when card changes
  useEffect(() => {
    setIsRevealed(false);
    setCardState('DEFAULT');
    setVoiceTranscript('');
    setProcessingAnswer(false);
  }, [card.id]);

  // Error handling effect
  useEffect(() => {
    if (studyError) {
      onError?.(new Error(studyError));
    }
  }, [studyError, onError]);

  return (
    <div 
      className={cn(
        'flex flex-col space-y-4 p-6 rounded-lg shadow-lg transition-colors',
        CARD_VARIANTS[cardState],
        className
      )}
      role="article"
      aria-label="Study card"
    >
      {/* Front content */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Question</h3>
        <div 
          className="prose dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: card.frontContent.text }}
        />
      </div>

      {/* Voice controls */}
      {isVoiceMode && (
        <VoiceControls
          onTranscriptReceived={handleVoiceTranscript}
          disabled={isRevealed || processingAnswer}
          confidenceThreshold={VOICE_CONFIDENCE_THRESHOLD}
          retryAttempts={VOICE_RETRY_ATTEMPTS}
          className="mt-4"
        />
      )}

      {/* Voice transcript display */}
      {voiceTranscript && (
        <div 
          className="text-sm text-gray-600 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          Your answer: {voiceTranscript}
        </div>
      )}

      {/* Reveal button */}
      {!isVoiceMode && !isRevealed && (
        <button
          onClick={handleReveal}
          disabled={processingAnswer}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 
                     focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          aria-label="Reveal answer"
        >
          Show Answer
        </button>
      )}

      {/* Back content */}
      {isRevealed && (
        <div className="space-y-2 mt-4 border-t pt-4">
          <h3 className="text-lg font-semibold">Answer</h3>
          <div 
            className="prose dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: card.backContent.text }}
          />
        </div>
      )}

      {/* Confidence buttons */}
      {isRevealed && !processingAnswer && (
        <ConfidenceButtons
          disabled={isLoading}
          onConfidenceSubmit={handleConfidenceRating}
          className="mt-4"
        />
      )}

      {/* Loading state */}
      {processingAnswer && (
        <div 
          className="flex items-center justify-center"
          role="status"
          aria-label="Processing answer"
        >
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

/**
 * Calculate similarity between answer and expected text
 */
function calculateAnswerSimilarity(answer: string, expected: string): number {
  const normalizedAnswer = answer.toLowerCase().trim();
  const normalizedExpected = expected.toLowerCase().trim();
  
  // Simple exact match for now - could be enhanced with more sophisticated comparison
  return normalizedAnswer === normalizedExpected ? 1 : 0;
}

export default CardDisplay;