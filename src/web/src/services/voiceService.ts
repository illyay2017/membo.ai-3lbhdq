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

declare global {
  type SpeechRecognition = any; // Temporary type definition
  
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private currentState: VoiceRecognitionState = VoiceRecognitionState.IDLE;
  private currentSessionId: string | null = null;
  private performanceMetrics = {
    startTime: 0,
    processingTimes: [] as number[],
    errorCount: 0,
  };

  private readonly DEFAULT_LANGUAGE = 'en-US';
  private readonly CONFIDENCE_THRESHOLD = 0.85;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

  async initializeVoiceService(config?: Partial<VoiceRecognitionConfig>): Promise<void> {
    try {
      this.recognition = await createVoiceRecognition({
        language: config?.language || this.DEFAULT_LANGUAGE,
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
        confidenceThreshold: this.CONFIDENCE_THRESHOLD,
        retryAttempts: this.MAX_RETRY_ATTEMPTS,
        retryInterval: this.RETRY_DELAY_MS,
        ...config,
      });

      this.recognition.addEventListener('voiceResult', this.handleVoiceResult.bind(this));
      this.recognition.addEventListener('voiceError', this.handleVoiceError.bind(this));
      this.currentState = VoiceRecognitionState.IDLE;
    } catch (error) {
      this.handleVoiceError(error as Error);
      throw new Error('Failed to initialize voice service');
    }
  }

  async startVoiceStudySession(studySessionId: string): Promise<void> {
    if (!this.recognition || this.currentState !== VoiceRecognitionState.IDLE) {
      throw new Error('Voice service not properly initialized');
    }

    try {
      this.currentSessionId = studySessionId;
      this.performanceMetrics = {
        startTime: Date.now(),
        processingTimes: [],
        errorCount: 0,
      };

      await startVoiceRecognition(this.recognition);
      
      await api.post('/api/v1/voice/session/start', {
        sessionId: studySessionId,
        config: {
          language: this.recognition.lang,
          confidenceThreshold: this.CONFIDENCE_THRESHOLD,
        },
      });
    } catch (error) {
      this.handleVoiceError(error as Error);
    }
  }

  async stopVoiceStudySession(): Promise<void> {
    if (!this.recognition || !this.currentSessionId) {
      return;
    }

    try {
      await stopVoiceRecognition(this.recognition);
      
      await api.post('/api/v1/voice/session/end', {
        sessionId: this.currentSessionId,
        metrics: {
          duration: Date.now() - this.performanceMetrics.startTime,
          averageProcessingTime: this.calculateAverageProcessingTime(),
          errorRate: this.performanceMetrics.errorCount,
        },
      });

      this.currentSessionId = null;
      this.currentState = VoiceRecognitionState.IDLE;
    } catch (error) {
      this.handleVoiceError(error as Error);
    }
  }

  async processVoiceAnswer(
    result: VoiceRecognitionResult,
    cardId: string
  ): Promise<{ correct: boolean; confidence: number; processingTime: number }> {
    const startTime = Date.now();

    try {
      if (!this.currentSessionId || !result.transcript) {
        throw new Error('Invalid voice processing state');
      }

      const response = await api.post('/api/v1/voice/process', {
        sessionId: this.currentSessionId,
        cardId,
        transcript: result.transcript,
        confidence: result.confidence,
        alternatives: result.alternatives,
      });

      const processingTime = Date.now() - startTime;
      this.performanceMetrics.processingTimes.push(processingTime);

      return {
        correct: response.correct,
        confidence: response.confidence,
        processingTime,
      };
    } catch (error) {
      this.handleVoiceError(error as Error);
      throw error;
    }
  }

  private async handleVoiceError(error: Error | Event | VoiceRecognitionError): Promise<void> {
    this.performanceMetrics.errorCount++;
    this.currentState = VoiceRecognitionState.ERROR;

    const errorDetails = {
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      state: this.currentState,
      message: error instanceof Error ? error.message : 'Voice recognition error',
      recoverable: true,
    };

    try {
      await api.post('/api/v1/voice/error', errorDetails);

      if (this.recognition && errorDetails.recoverable) {
        await stopVoiceRecognition(this.recognition);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
        await startVoiceRecognition(this.recognition);
        this.currentState = VoiceRecognitionState.LISTENING;
      }
    } catch (recoveryError) {
      console.error('Failed to recover from voice error:', recoveryError);
      this.currentState = VoiceRecognitionState.ERROR;
    }
  }

  private handleVoiceResult(event: CustomEvent<VoiceRecognitionResult>): void {
    const result = event.detail;
    
    if (result.confidence >= this.CONFIDENCE_THRESHOLD && result.isFinal) {
      this.currentState = VoiceRecognitionState.PROCESSING;
      this.recognition?.dispatchEvent(
        new CustomEvent('processedVoiceResult', { detail: result })
      );
    }
  }

  private calculateAverageProcessingTime(): number {
    if (this.performanceMetrics.processingTimes.length === 0) {
      return 0;
    }
    
    const sum = this.performanceMetrics.processingTimes.reduce((a, b) => a + b, 0);
    return sum / this.performanceMetrics.processingTimes.length;
  }
}
