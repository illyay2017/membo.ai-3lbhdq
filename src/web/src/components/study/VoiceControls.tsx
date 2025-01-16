/**
 * Voice controls component for study interface with comprehensive error handling
 * and accessibility support. Implements voice-first interaction design.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react'; // v0.284.0
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import Button from '../ui/button';
import { colors } from '../../constants/theme';

interface VoiceControlsProps {
  className?: string;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onError?: (error: VoiceError) => void;
  disabled?: boolean;
  confidenceThreshold?: number;
  retryAttempts?: number;
}

interface VoiceError {
  code: string;
  message: string;
  retry: boolean;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  className = '',
  onVoiceStart,
  onVoiceEnd,
  onError,
  disabled = false,
  confidenceThreshold = 0.85,
  retryAttempts = 3
}) => {
  // Voice recognition state management
  const {
    state,
    transcript,
    isListening,
    startListening,
    stopListening,
    error,
    confidence
  } = useVoiceRecognition({
    confidenceThreshold,
    retryAttempts
  });

  // Local state for UI feedback
  const [retryCount, setRetryCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Handle voice toggle with error handling and metrics
  const handleVoiceToggle = useCallback(async () => {
    try {
      if (!isListening) {
        const startTime = performance.now();
        await startListening();
        const latency = performance.now() - startTime;
        
        // Update accessibility message
        setStatusMessage('Voice recognition active. Speak your answer.');
        onVoiceStart?.();

        // Log performance metric
        console.debug(`Voice start latency: ${latency}ms`);
      } else {
        await stopListening();
        setStatusMessage('Voice recognition stopped.');
        onVoiceEnd?.();
      }
    } catch (err) {
      const voiceError: VoiceError = {
        code: 'VOICE_TOGGLE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to toggle voice recognition',
        retry: retryCount < retryAttempts
      };
      handleError(voiceError);
    }
  }, [isListening, startListening, stopListening, onVoiceStart, onVoiceEnd, retryCount, retryAttempts]);

  // Handle voice recognition errors
  const handleError = useCallback((voiceError: VoiceError) => {
    setStatusMessage(`Error: ${voiceError.message}`);
    
    if (voiceError.retry) {
      setRetryCount(prev => prev + 1);
      // Implement exponential backoff for retries
      const backoffDelay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => handleVoiceToggle(), backoffDelay);
    }

    onError?.(voiceError);
  }, [retryCount, handleVoiceToggle, onError]);

  // Reset retry count on successful voice state change
  useEffect(() => {
    if (isListening) {
      setRetryCount(0);
    }
  }, [isListening]);

  // Update status message based on state changes
  useEffect(() => {
    if (error) {
      setStatusMessage(`Error: ${error.message}`);
    } else if (transcript) {
      setStatusMessage(`Recognized: ${transcript}`);
    }
  }, [error, transcript]);

  return (
    <div 
      className={`flex items-center space-x-4 ${className}`}
      role="region"
      aria-label="Voice controls"
    >
      <Button
        variant={isListening ? 'primary' : 'outline'}
        size="md"
        onClick={handleVoiceToggle}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? 'Stop voice recognition' : 'Start voice recognition'}
        title={statusMessage}
      >
        {isListening ? (
          <Mic className="w-5 h-5 mr-2" />
        ) : (
          <MicOff className="w-5 h-5 mr-2" />
        )}
        {isListening ? 'Stop Voice' : 'Start Voice'}
      </Button>

      {/* Confidence indicator */}
      {isListening && confidence > 0 && (
        <div 
          className="flex items-center"
          role="meter"
          aria-label="Voice recognition confidence"
          aria-valuenow={Math.round(confidence * 100)}
        >
          <div 
            className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden"
            title={`Confidence: ${Math.round(confidence * 100)}%`}
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${confidence * 100}%`,
                backgroundColor: confidence >= confidenceThreshold ? colors.semantic.success : colors.semantic.warning
              }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div 
          className="flex items-center text-error"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm">{error.message}</span>
        </div>
      )}

      {/* Live transcript */}
      {transcript && (
        <div 
          className="text-sm text-secondary"
          aria-live="polite"
        >
          {transcript}
        </div>
      )}

      {/* Hidden status message for screen readers */}
      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>
    </div>
  );
};

export default VoiceControls;