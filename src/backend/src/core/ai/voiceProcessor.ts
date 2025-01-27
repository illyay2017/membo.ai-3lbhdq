/**
 * @fileoverview Core voice processing module for membo.ai learning system
 * Implements high-performance speech-to-text conversion and answer validation
 * with multi-language support, caching, and comprehensive monitoring.
 * @version 1.0.0
 */

import { injectable, singleton } from 'tsyringe';
import { openai, ConfiguredOpenAI } from '../../config/openai';
import { voiceInputSchema } from '../../api/validators/voice.validator';
import { RateLimiter } from 'limiter'; // ^2.0.0
import { Redis } from 'redis'; // ^4.6.0
import winston from 'winston'; // ^3.10.0
import crypto from 'crypto';
import { File } from 'buffer';  // Add this import

// Global configuration for voice processing
const VOICE_PROCESSING_CONFIG = {
  maxDuration: 30,
  sampleRate: 16000,
  format: 'wav',
  confidenceThreshold: 0.7,
  whisperModel: 'whisper-1',
  cacheExpiry: 3600,
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 5
} as const;

// Supported languages for voice processing
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] as const;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  windowMs: 60000,
  errorMessage: 'Too many voice processing requests'
} as const;

/**
 * Interface for voice processing result
 */
interface VoiceProcessingResult {
  text: string;
  confidence: number;
  processingTime: number;
  language: string;
}

/**
 * Interface for answer validation result
 */
interface ValidationResult {
  isCorrect: boolean;
  similarity: number;
  confidence: number;
  processingTime: number;
}

/**
 * Core voice processing service with optimized performance and caching
 */
@injectable()
@singleton()
export class VoiceProcessor {
  private readonly rateLimiter: RateLimiter;

  constructor(
    private readonly logger: winston.Logger,
    private readonly openai: ConfiguredOpenAI,
    private readonly cache: Redis,
    private readonly metrics?: any  // Make metrics optional
  ) {
    if (!cache) {
      throw new Error('Redis cache instance is required');
    }

    // Log OpenAI instance details
    this.logger.info('VoiceProcessor initialized', {
      hasOpenAI: !!this.openai,
      hasAudioAPI: !!(this.openai?.audio?.transcriptions),
      openAIType: typeof this.openai
    });

    this.rateLimiter = new RateLimiter({
      tokensPerInterval: RATE_LIMIT_CONFIG.maxRequests,
      interval: RATE_LIMIT_CONFIG.windowMs
    });
  }

  /**
   * Processes voice input with caching and performance optimization
   * @param audioData - Raw audio buffer
   * @param language - Target language code
   * @param userId - User identifier for rate limiting
   * @returns Processed voice result with confidence scoring
   * @throws Error if processing fails or rate limit exceeded
   */
  public async processVoiceInput(
    audioData: Buffer,
    language: string,
    userId: string
  ): Promise<VoiceProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing voice with OpenAI', {
        hasOpenAI: !!this.openai,
        hasAudioAPI: !!(this.openai?.audio?.transcriptions),
        audioSize: audioData.length,
        language
      });

      // Create a File object from the buffer
      const audioFile = new File(
        [audioData],
        'audio.wav',
        { type: 'audio/wav' }
      );

      // Validate input parameters
      if (!Buffer.isBuffer(audioData)) {
        throw new Error('Audio data must be a Buffer');
      }

      if (!SUPPORTED_LANGUAGES.includes(language as any)) {
        throw new Error('Unsupported language');
      }

      // Check rate limit
      if (!await this.rateLimiter.tryRemoveTokens(1)) {
        throw new Error(RATE_LIMIT_CONFIG.errorMessage);
      }

      // Generate audio fingerprint for caching
      const audioFingerprint = this.generateAudioFingerprint(audioData);
      
      // Check cache first
      const cachedResult = await this.cache.get(`voice:${audioFingerprint}`);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Preprocess audio for optimal quality
      const processedAudio = await this.preprocessAudio(audioData);

      // Process with OpenAI's Whisper model
      const transcriptionResult = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: VOICE_PROCESSING_CONFIG.whisperModel,
        language: SUPPORTED_LANGUAGES.includes(language as any) ? language : 'en',
        response_format: 'json'
      });

      this.logger.debug('OpenAI transcription completed', {
        success: !!transcriptionResult,
        responseType: typeof transcriptionResult
      });

      // Calculate confidence score
      const confidence = this.calculateConfidence(transcriptionResult);

      const result: VoiceProcessingResult = {
        text: transcriptionResult.text,
        confidence,
        processingTime: Date.now() - startTime,
        language
      };

      // Cache result
      await this.cache.setex(
        `voice:${audioFingerprint}`,
        VOICE_PROCESSING_CONFIG.cacheExpiry,
        JSON.stringify(result)
      );

      // Record metrics if available
      if (this.metrics) {  // Simple null check
        try {
          this.metrics.recordVoiceProcessing?.({
            userId,
            duration: result.processingTime,
            confidence: result.confidence,
            language
          });
        } catch (error) {
          // Log but don't fail if metrics recording fails
          this.logger.warn('Failed to record metrics:', error);
        }
      }

      return result;

    } catch (error) {
      this.logger.error('Voice processing failed:', {
        error: error.message,
        userId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Validates transcribed answer against expected response
   * @param transcribedText - Processed voice input text
   * @param expectedAnswer - Expected answer text
   * @param language - Language code for comparison
   * @returns Validation result with similarity scoring
   */
  public async validateAnswer(
    transcribedText: string,
    expectedAnswer: string,
    language: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Normalize both answers for comparison
      const normalizedTranscribed = this.normalizeText(transcribedText, language);
      const normalizedExpected = this.normalizeText(expectedAnswer, language);

      // Calculate semantic similarity using OpenAI
      const similarity = await this.calculateSimilarity(
        normalizedTranscribed,
        normalizedExpected,
        language
      );

      // Calculate confidence based on similarity
      const confidence = this.calculateValidationConfidence(similarity);

      const result: ValidationResult = {
        isCorrect: similarity >= VOICE_PROCESSING_CONFIG.confidenceThreshold,
        similarity,
        confidence,
        processingTime: Date.now() - startTime
      };

      // Cache validation result
      const cacheKey = `validation:${crypto
        .createHash('md5')
        .update(`${transcribedText}:${expectedAnswer}`)
        .digest('hex')}`;
      
      await this.cache.setex(
        cacheKey,
        VOICE_PROCESSING_CONFIG.cacheExpiry,
        JSON.stringify(result)
      );

      return result;

    } catch (error) {
      this.logger.error('Answer validation failed', {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Generates a unique fingerprint for audio data
   */
  private generateAudioFingerprint(audioData: Buffer): string {
    // Create a new hash instance each time
    const hasher = crypto.createHash('sha256');
    hasher.update(audioData);
    return hasher.digest('hex');
  }

  /**
   * Preprocesses audio for optimal quality
   * @private
   */
  private async preprocessAudio(audioData: Buffer): Promise<Buffer> {
    // Implement audio preprocessing logic
    // - Noise reduction
    // - Sample rate conversion
    // - Format standardization
    return audioData; // Placeholder for actual implementation
  }

  /**
   * Calculates confidence score for transcription
   * @private
   */
  private calculateConfidence(transcriptionResult: any): number {
    // Implement confidence calculation logic
    return Math.min(
      transcriptionResult.confidence || 0.7,
      1.0
    );
  }

  /**
   * Normalizes text for comparison
   * @private
   */
  private normalizeText(text: string, language: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFKC');
  }

  /**
   * Calculates semantic similarity between texts
   * @private
   */
  private async calculateSimilarity(
    text1: string,
    text2: string,
    language: string
  ): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Calculate semantic similarity between two texts (0-1)'
          },
          {
            role: 'user',
            content: `Compare: "${text1}" and "${text2}" in ${language}`
          }
        ],
        temperature: 0.1,
        max_tokens: 50
      });

      // Add null checks and logging
      this.logger.debug('Similarity calculation response:', {
        hasResponse: !!response,
        hasChoices: !!(response?.choices),
        firstChoice: response?.choices?.[0]
      });

      // Safely access the response
      const similarityText = response?.choices?.[0]?.message?.content || '0';
      return parseFloat(similarityText) || 0;

    } catch (error) {
      this.logger.error('Similarity calculation failed:', error);
      return 0; // Return 0 similarity on error
    }
  }

  /**
   * Calculates validation confidence score
   * @private
   */
  private calculateValidationConfidence(similarity: number): number {
    return Math.pow(similarity, 2); // Quadratic scaling for confidence
  }
}
