import { OpenAIApi } from 'openai'; // version: ^4.0.0
import pino from 'pino'; // version: ^8.0.0
import { IContent, ContentStatus } from '../../interfaces/IContent';
import { openai } from '../../config/openai';
import { CardGenerator } from './cardGenerator';
import { sanitizeInput, validateSchema } from '../../utils/validation';

// Global constants for content processing
const CONTENT_ANALYSIS_PROMPT = `Analyze the following content and provide:
1. Main topics and key concepts
2. Content complexity level (beginner/intermediate/advanced)
3. Recommended card types and study approaches
4. Language and terminology assessment
5. Prerequisites and related concepts

Content to analyze:`;

const MAX_CHUNK_SIZE = 4000;
const MIN_CONTENT_LENGTH = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const PROCESSING_TIMEOUT = 10000;

// Configure logger
const logger = pino({
  name: 'content-processor',
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Interfaces for content processing
interface ProcessingMetrics {
  startTime: number;
  endTime: number;
  processingDuration: number;
  tokenCount: number;
  chunkCount: number;
  retryCount: number;
}

interface ProcessingOptions {
  maxChunkSize?: number;
  preserveFormatting?: boolean;
  enableCache?: boolean;
  securityScan?: boolean;
}

/**
 * Enhanced content processor with comprehensive analysis and optimization
 */
class ContentProcessor {
  private metrics: ProcessingMetrics;
  private cardGenerator: CardGenerator;

  constructor(
    private openaiClient: OpenAIApi,
    private options: ProcessingOptions = {}
  ) {
    this.cardGenerator = new CardGenerator(openaiClient);
    this.metrics = this.initializeMetrics();
    this.validateConfiguration();
  }

  /**
   * Process content with comprehensive analysis and card generation
   */
  public async processContent(content: IContent): Promise<IContent> {
    try {
      this.metrics.startTime = Date.now();
      logger.info({ event: 'content_processing_start', contentId: content.id });

      // Validate input content
      this.validateContent(content);

      // Update content status
      content.status = ContentStatus.PROCESSING;

      // Sanitize content
      const sanitizedContent = this.sanitizeContent(content.content);

      // Analyze content
      const analysisResult = await this.analyzeContent(sanitizedContent);

      // Update content metadata with analysis results
      content.metadata = {
        ...content.metadata,
        ...analysisResult,
        processingMetrics: this.getMetrics(),
      };

      // Generate cards if analysis is successful
      if (analysisResult.isProcessable) {
        await this.cardGenerator.generateFromContent(content);
      }

      // Update final status
      content.status = ContentStatus.PROCESSED;
      content.processedAt = new Date();

      this.metrics.endTime = Date.now();
      this.metrics.processingDuration = this.metrics.endTime - this.metrics.startTime;

      logger.info({
        event: 'content_processing_complete',
        contentId: content.id,
        metrics: this.getMetrics(),
      });

      return content;
    } catch (error) {
      content.status = ContentStatus.ERROR;
      content.metadata.error = {
        message: error.message,
        timestamp: new Date(),
      };

      logger.error({
        event: 'content_processing_error',
        contentId: content.id,
        error: error.message,
        metrics: this.getMetrics(),
      });

      throw error;
    }
  }

  /**
   * Analyze content using OpenAI with retry mechanism
   */
  private async analyzeContent(content: string): Promise<any> {
    let attempt = 0;
    
    while (attempt < MAX_RETRIES) {
      try {
        const completion = await this.openaiClient.createChatCompletion({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: CONTENT_ANALYSIS_PROMPT,
            },
            {
              role: 'user',
              content,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          timeout: PROCESSING_TIMEOUT,
        });

        this.metrics.tokenCount = completion.data.usage.total_tokens;
        return this.parseAnalysisResponse(completion.data.choices[0].message.content);
      } catch (error) {
        attempt++;
        this.metrics.retryCount++;

        if (attempt === MAX_RETRIES) {
          throw new Error(`Content analysis failed after ${MAX_RETRIES} attempts: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }

  /**
   * Sanitize content with security measures
   */
  private sanitizeContent(rawContent: string): string {
    return sanitizeInput(rawContent, {
      stripTags: true,
      escapeHTML: true,
      preventSQLInjection: true,
    });
  }

  /**
   * Chunk content for optimal processing
   */
  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const maxSize = this.options.maxChunkSize || MAX_CHUNK_SIZE;
    
    let currentChunk = '';
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxSize) {
        currentChunk += sentence + '. ';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + '. ';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    this.metrics.chunkCount = chunks.length;
    return chunks;
  }

  /**
   * Validate content before processing
   */
  private validateContent(content: IContent): void {
    if (!content.content || 
        content.content.length < MIN_CONTENT_LENGTH || 
        content.content.length > MAX_CHUNK_SIZE * 3) {
      throw new Error('Content length out of acceptable range');
    }

    const validationResult = validateSchema(content, {
      content: 'required|string',
      metadata: 'required|object',
      status: 'required|string',
    });

    if (!validationResult.isValid) {
      throw new Error(`Content validation failed: ${validationResult.errors[0]?.message}`);
    }
  }

  /**
   * Parse and structure analysis response
   */
  private parseAnalysisResponse(response: string): any {
    try {
      const parsed = JSON.parse(response);
      return {
        topics: parsed.topics || [],
        complexity: parsed.complexity || 'intermediate',
        recommendedCardTypes: parsed.recommendedCardTypes || ['basic'],
        languageAssessment: parsed.languageAssessment || {},
        prerequisites: parsed.prerequisites || [],
        isProcessable: true,
      };
    } catch (error) {
      logger.error({
        event: 'analysis_parse_error',
        error: error.message,
        response,
      });
      return {
        isProcessable: false,
        error: 'Failed to parse analysis response',
      };
    }
  }

  /**
   * Initialize processing metrics
   */
  private initializeMetrics(): ProcessingMetrics {
    return {
      startTime: 0,
      endTime: 0,
      processingDuration: 0,
      tokenCount: 0,
      chunkCount: 0,
      retryCount: 0,
    };
  }

  /**
   * Validate processor configuration
   */
  private validateConfiguration(): void {
    if (!this.openaiClient) {
      throw new Error('OpenAI client is required');
    }

    if (this.options.maxChunkSize && this.options.maxChunkSize > MAX_CHUNK_SIZE) {
      throw new Error(`Maximum chunk size cannot exceed ${MAX_CHUNK_SIZE}`);
    }
  }

  /**
   * Get current processing metrics
   */
  public getMetrics(): ProcessingMetrics {
    return this.metrics;
  }
}

// Export the content processor class and standalone functions
export { ContentProcessor, ProcessingMetrics, ProcessingOptions };
export const analyzeContent = async (content: IContent): Promise<any> => {
  const processor = new ContentProcessor(openai);
  return processor.processContent(content);
};

export const sanitizeContent = (rawContent: string): string => {
  return sanitizeInput(rawContent, {
    stripTags: true,
    escapeHTML: true,
    preventSQLInjection: true,
  });
};