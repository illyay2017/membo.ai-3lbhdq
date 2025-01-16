/**
 * @fileoverview WebSocket handler for managing real-time voice interactions in the membo.ai learning system.
 * Implements voice processing pipeline with performance monitoring and enhanced error handling.
 * @version 1.0.0
 */

import WebSocket from 'ws'; // ^8.x
import winston from 'winston'; // ^3.10.0
import { VoiceService } from '../../services/VoiceService';
import { StudyModes } from '../../constants/studyModes';

// WebSocket event constants
const WS_VOICE_EVENTS = {
  VOICE_START: 'voice:start',
  VOICE_INPUT: 'voice:input',
  VOICE_RESULT: 'voice:result',
  VOICE_ERROR: 'voice:error',
  VOICE_END: 'voice:end',
  VOICE_TIMEOUT: 'voice:timeout',
  VOICE_RETRY: 'voice:retry'
} as const;

// Voice processing timeouts and limits
const VOICE_TIMEOUTS = {
  INPUT_TIMEOUT: 30000, // 30 seconds
  PROCESSING_TIMEOUT: 10000, // 10 seconds
  RETRY_DELAY: 2000, // 2 seconds
  MAX_RETRIES: 3
} as const;

// Performance metrics keys
const VOICE_METRICS = {
  PROCESSING_TIME: 'voice_processing_duration_ms',
  SUCCESS_RATE: 'voice_recognition_success_rate',
  ERROR_COUNT: 'voice_processing_errors',
  ACTIVE_SESSIONS: 'active_voice_sessions'
} as const;

// Voice session metrics interface
interface VoiceSessionMetrics {
  startTime: number;
  processingTime: number;
  successCount: number;
  errorCount: number;
  retryCount: number;
}

// Voice session configuration interface
interface VoiceSessionConfig {
  language: string;
  confidenceThreshold: number;
  useNativeSpeaker: boolean;
}

/**
 * Handles WebSocket events for voice-based study interactions
 * with performance monitoring and enhanced error handling
 */
export class VoiceHandler {
  private readonly voiceService: VoiceService;
  private readonly logger: winston.Logger;
  private readonly activeVoiceSessions: Map<string, WebSocket>;
  private readonly sessionMetrics: Map<string, VoiceSessionMetrics>;
  private readonly retryCount: Map<string, number>;

  constructor(
    voiceService: VoiceService,
    logger: winston.Logger,
    private readonly metricsCollector: any
  ) {
    this.voiceService = voiceService;
    this.logger = logger.child({ service: 'VoiceHandler' });
    this.activeVoiceSessions = new Map();
    this.sessionMetrics = new Map();
    this.retryCount = new Map();

    // Update active sessions metric every minute
    setInterval(() => {
      this.metricsCollector.gauge(
        VOICE_METRICS.ACTIVE_SESSIONS,
        this.activeVoiceSessions.size
      );
    }, 60000);
  }

  /**
   * Handles new WebSocket connections for voice study mode
   */
  public async handleVoiceConnection(
    ws: WebSocket,
    userId: string,
    sessionConfig: VoiceSessionConfig
  ): Promise<void> {
    const sessionId = `voice_${userId}_${Date.now()}`;

    try {
      // Validate voice capability
      const capability = await this.voiceService.validateVoiceCapability(userId);
      if (!capability.isAvailable) {
        throw new Error(`Voice capability not available: ${capability.reason}`);
      }

      // Initialize session metrics
      this.sessionMetrics.set(sessionId, {
        startTime: Date.now(),
        processingTime: 0,
        successCount: 0,
        errorCount: 0,
        retryCount: 0
      });

      // Set up WebSocket event listeners
      this.setupVoiceEventListeners(ws, sessionId, sessionConfig);

      // Add to active sessions
      this.activeVoiceSessions.set(sessionId, ws);

      // Send confirmation to client
      ws.send(JSON.stringify({
        event: WS_VOICE_EVENTS.VOICE_START,
        sessionId,
        config: sessionConfig
      }));

      this.logger.info('Voice session started', {
        sessionId,
        userId,
        language: sessionConfig.language
      });

    } catch (error) {
      this.handleVoiceError(ws, sessionId, error);
    }
  }

  /**
   * Processes incoming voice input with performance monitoring
   */
  private async handleVoiceInput(
    ws: WebSocket,
    sessionId: string,
    message: {
      audioData: Buffer;
      expectedAnswer: string;
      language: string;
      confidence: number;
    }
  ): Promise<void> {
    const startTime = Date.now();
    const metrics = this.sessionMetrics.get(sessionId);

    try {
      const result = await this.voiceService.processStudyAnswer(
        sessionId,
        message.audioData,
        message.expectedAnswer,
        message.language
      );

      // Update session metrics
      if (metrics) {
        metrics.processingTime += Date.now() - startTime;
        metrics.successCount++;
        this.sessionMetrics.set(sessionId, metrics);
      }

      // Send result to client
      ws.send(JSON.stringify({
        event: WS_VOICE_EVENTS.VOICE_RESULT,
        result: {
          text: result.text,
          isCorrect: result.isCorrect,
          confidence: result.confidence,
          processingTime: Date.now() - startTime
        }
      }));

      // Record performance metrics
      this.metricsCollector.histogram(
        VOICE_METRICS.PROCESSING_TIME,
        Date.now() - startTime
      );
      this.metricsCollector.gauge(
        VOICE_METRICS.SUCCESS_RATE,
        metrics ? metrics.successCount / (metrics.successCount + metrics.errorCount) : 1
      );

    } catch (error) {
      await this.handleVoiceProcessingError(ws, sessionId, error);
    }
  }

  /**
   * Sets up WebSocket event listeners for voice session
   */
  private setupVoiceEventListeners(
    ws: WebSocket,
    sessionId: string,
    config: VoiceSessionConfig
  ): void {
    // Handle incoming messages
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.event) {
          case WS_VOICE_EVENTS.VOICE_INPUT:
            await this.handleVoiceInput(ws, sessionId, message.data);
            break;
          case WS_VOICE_EVENTS.VOICE_END:
            await this.handleVoiceEnd(sessionId);
            break;
          default:
            this.logger.warn('Unknown voice event received', {
              sessionId,
              event: message.event
            });
        }
      } catch (error) {
        this.handleVoiceError(ws, sessionId, error);
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleVoiceEnd(sessionId);
    });

    // Set up session timeout
    setTimeout(() => {
      if (this.activeVoiceSessions.has(sessionId)) {
        this.handleVoiceTimeout(ws, sessionId);
      }
    }, VOICE_TIMEOUTS.INPUT_TIMEOUT);
  }

  /**
   * Handles voice processing errors with retry logic
   */
  private async handleVoiceProcessingError(
    ws: WebSocket,
    sessionId: string,
    error: Error
  ): Promise<void> {
    const retries = this.retryCount.get(sessionId) || 0;
    const metrics = this.sessionMetrics.get(sessionId);

    if (metrics) {
      metrics.errorCount++;
      metrics.retryCount = retries;
      this.sessionMetrics.set(sessionId, metrics);
    }

    this.metricsCollector.increment(VOICE_METRICS.ERROR_COUNT);

    if (retries < VOICE_TIMEOUTS.MAX_RETRIES) {
      this.retryCount.set(sessionId, retries + 1);
      
      // Notify client of retry
      ws.send(JSON.stringify({
        event: WS_VOICE_EVENTS.VOICE_RETRY,
        error: error.message,
        retryCount: retries + 1,
        retryDelay: VOICE_TIMEOUTS.RETRY_DELAY
      }));

      // Attempt retry after delay
      setTimeout(async () => {
        try {
          await this.voiceService.processVoiceRetry(sessionId);
        } catch (retryError) {
          this.handleVoiceError(ws, sessionId, retryError);
        }
      }, VOICE_TIMEOUTS.RETRY_DELAY);

    } else {
      this.handleVoiceError(ws, sessionId, error);
    }
  }

  /**
   * Handles voice session timeout
   */
  private handleVoiceTimeout(ws: WebSocket, sessionId: string): void {
    ws.send(JSON.stringify({
      event: WS_VOICE_EVENTS.VOICE_TIMEOUT,
      message: 'Voice session timed out due to inactivity'
    }));

    this.handleVoiceEnd(sessionId);
  }

  /**
   * Handles voice session end and cleanup
   */
  private async handleVoiceEnd(sessionId: string): Promise<void> {
    const ws = this.activeVoiceSessions.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);

    if (ws) {
      ws.send(JSON.stringify({
        event: WS_VOICE_EVENTS.VOICE_END,
        metrics: metrics
      }));

      this.activeVoiceSessions.delete(sessionId);
      this.sessionMetrics.delete(sessionId);
      this.retryCount.delete(sessionId);

      this.logger.info('Voice session ended', {
        sessionId,
        duration: metrics ? Date.now() - metrics.startTime : 0,
        metrics
      });
    }
  }

  /**
   * Handles voice errors and sends error response
   */
  private handleVoiceError(
    ws: WebSocket,
    sessionId: string,
    error: Error
  ): void {
    this.logger.error('Voice error occurred', {
      sessionId,
      error: error.message,
      stack: error.stack
    });

    ws.send(JSON.stringify({
      event: WS_VOICE_EVENTS.VOICE_ERROR,
      error: error.message
    }));

    this.handleVoiceEnd(sessionId);
  }
}