/**
 * @fileoverview Voice service implementation for membo.ai web application
 * Provides high-level voice interaction capabilities with enhanced error handling,
 * performance monitoring, and state management.
 * @version 1.0.0
 */

import { api } from '../lib/api';
import {
  createVoiceRecognition,
  startVoiceRecognition,
  stopVoiceRecognition,
} from '../lib/voice';
import {
  VoiceRecognitionState,
  VoiceRecognitionConfig,
  VoiceRecognitionResult,
  VoiceRecognitionError,
} from '../types/voice';

// Global constants
const DEFAULT_LANGUAGE = 'en-US';
const CONFIDENCE_THRESHOLD = 0.85;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Service state
let recognition: SpeechRecognition | null = null;
let currentState: VoiceRecognitionState = VoiceRecognitionState.IDLE;
let currentSessionId: string | null = null;
let performanceMetrics: {
  startTime: number;
  processingTimes: number[];
  errorCount: number;
} = {
  startTime: 0,
  processingTimes: [],
  errorCount: 0,
};

/**
 * Initializes the voice service with enhanced configuration and browser checks
 * @param config Optional voice recognition configuration
 */
export async function initializeVoiceService(
  config?: Partial<VoiceRecognitionConfig>
): Promise<void> {
  try {
    recognition = await createVoiceRecognition({
      language: config?.language || DEFAULT_LANGUAGE,
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      confidenceThreshold: CONFIDENCE_THRESHOLD,
      retryAttempts: MAX_RETRY_ATTEMPTS,
      retryInterval: RETRY_DELAY_MS,
      ...config,
    });

    recognition.addEventListener('voiceResult', handleVoiceResult);
    recognition.addEventListener('voiceError', handleVoiceError);

    currentState = VoiceRecognitionState.IDLE;
  } catch (error) {
    handleVoiceError(error as Error);
    throw new Error('Failed to initialize voice service');
  }
}

/**
 * Starts a voice-enabled study session with performance monitoring
 * @param studySessionId Unique identifier for the study session
 */
export async function startVoiceStudySession(studySessionId: string): Promise<void> {
  if (!recognition || currentState !== VoiceRecognitionState.IDLE) {
    throw new Error('Voice service not properly initialized');
  }

  try {
    currentSessionId = studySessionId;
    performanceMetrics = {
      startTime: Date.now(),
      processingTimes: [],
      errorCount: 0,
    };

    await startVoiceRecognition(recognition);
    
    // Initialize session with API
    await api.post('/api/v1/voice/session/start', {
      sessionId: studySessionId,
      config: {
        language: recognition.lang,
        confidenceThreshold: CONFIDENCE_THRESHOLD,
      },
    });
  } catch (error) {
    handleVoiceError(error as Error);
  }
}

/**
 * Stops the current voice study session and cleans up resources
 */
export async function stopVoiceStudySession(): Promise<void> {
  if (!recognition || !currentSessionId) {
    return;
  }

  try {
    await stopVoiceRecognition(recognition);
    
    // Send session metrics to API
    await api.post('/api/v1/voice/session/end', {
      sessionId: currentSessionId,
      metrics: {
        duration: Date.now() - performanceMetrics.startTime,
        averageProcessingTime: calculateAverageProcessingTime(),
        errorRate: performanceMetrics.errorCount,
      },
    });

    currentSessionId = null;
    currentState = VoiceRecognitionState.IDLE;
  } catch (error) {
    handleVoiceError(error as Error);
  }
}

/**
 * Processes voice recognition results with confidence scoring
 * @param result Voice recognition result to process
 * @param cardId ID of the current study card
 */
export async function processVoiceAnswer(
  result: VoiceRecognitionResult,
  cardId: string
): Promise<{ correct: boolean; confidence: number; processingTime: number }> {
  const startTime = Date.now();

  try {
    if (!currentSessionId || !result.transcript) {
      throw new Error('Invalid voice processing state');
    }

    const response = await api.post('/api/v1/voice/process', {
      sessionId: currentSessionId,
      cardId,
      transcript: result.transcript,
      confidence: result.confidence,
      alternatives: result.alternatives,
    });

    const processingTime = Date.now() - startTime;
    performanceMetrics.processingTimes.push(processingTime);

    return {
      correct: response.correct,
      confidence: response.confidence,
      processingTime,
    };
  } catch (error) {
    handleVoiceError(error as Error);
    throw error;
  }
}

/**
 * Handles voice recognition errors with recovery attempts
 * @param error Error object or event to handle
 */
export async function handleVoiceError(
  error: Error | Event | VoiceRecognitionError
): Promise<void> {
  performanceMetrics.errorCount++;
  currentState = VoiceRecognitionState.ERROR;

  const errorDetails = {
    timestamp: Date.now(),
    sessionId: currentSessionId,
    state: currentState,
    message: error instanceof Error ? error.message : 'Voice recognition error',
    recoverable: true,
  };

  try {
    // Log error to API for monitoring
    await api.post('/api/v1/voice/error', errorDetails);

    // Attempt recovery if possible
    if (recognition && errorDetails.recoverable) {
      await stopVoiceRecognition(recognition);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      await startVoiceRecognition(recognition);
      currentState = VoiceRecognitionState.LISTENING;
    }
  } catch (recoveryError) {
    console.error('Failed to recover from voice error:', recoveryError);
    currentState = VoiceRecognitionState.ERROR;
  }
}

/**
 * Handles incoming voice recognition results
 * @param event Custom event containing voice result
 */
function handleVoiceResult(event: CustomEvent<VoiceRecognitionResult>): void {
  const result = event.detail;
  
  if (result.confidence >= CONFIDENCE_THRESHOLD && result.isFinal) {
    currentState = VoiceRecognitionState.PROCESSING;
    // Dispatch result for processing
    recognition?.dispatchEvent(
      new CustomEvent('processedVoiceResult', { detail: result })
    );
  }
}

/**
 * Calculates average processing time from metrics
 */
function calculateAverageProcessingTime(): number {
  if (performanceMetrics.processingTimes.length === 0) {
    return 0;
  }
  
  const sum = performanceMetrics.processingTimes.reduce((a, b) => a + b, 0);
  return sum / performanceMetrics.processingTimes.length;
}

// Export voice service interface
export const voiceService = {
  initializeVoiceService,
  startVoiceStudySession,
  stopVoiceStudySession,
  processVoiceAnswer,
  handleVoiceError,
};
