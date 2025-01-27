// openai version: ^4.0.0
// limiter version: ^2.0.0
// pino version: ^8.0.0

import OpenAI from 'openai';
import { RateLimiter } from 'limiter';
import pino from 'pino';

// Global constants for OpenAI configuration
export const DEFAULT_MODEL = 'gpt-4';
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 2048;
export const REQUEST_TIMEOUT = 30000;
export const MAX_RETRIES = 3;
export const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
export const RATE_LIMIT_REQUESTS = 50;

// Logger instance for monitoring and debugging
const logger = pino({
  name: 'openai-client',
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Validates OpenAI API credentials format and presence
 * @param apiKey - OpenAI API key
 * @param orgId - OpenAI organization ID
 * @returns boolean indicating if credentials are valid
 */
const validateCredentials = (apiKey: string, orgId: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') {
    logger.error('OpenAI API key is missing or invalid');
    return false;
  }

  if (!orgId || typeof orgId !== 'string') {
    logger.error('OpenAI organization ID is missing or invalid');
    return false;
  }

  // Validate API key format (sk-... format)
  const apiKeyRegex = /^sk-(?:proj-)?[A-Za-z0-9-_]{32,}$/;
  if (!apiKeyRegex.test(apiKey)) {
    logger.error('OpenAI API key format is invalid');
    return false;
  }

  // Validate organization ID format (org-... format)
  const orgIdRegex = /^org-[A-Za-z0-9]{24}$/;
  if (!orgIdRegex.test(orgId)) {
    logger.error('OpenAI organization ID format is invalid');
    return false;
  }

  return true;
};

/**
 * Creates OpenAI configuration with API credentials
 * @returns Configuration instance with validated credentials
 * @throws Error if credentials are invalid or missing
 */
const createOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const orgId = process.env.OPENAI_ORG_ID;

  if (!validateCredentials(apiKey, orgId)) {
    throw new Error('Invalid OpenAI credentials');
  }

  return { apiKey, organization: orgId };
};

/**
 * Creates rate limiter instance for API request throttling
 * @returns Configured rate limiter instance
 */
const initializeRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    tokensPerInterval: RATE_LIMIT_REQUESTS,
    interval: RATE_LIMIT_WINDOW,
    fireImmediately: true,
  });
};

/**
 * OpenAI client wrapper with enhanced functionality
 */
export class OpenAIClient {
  private readonly client: OpenAI;
  private rateLimiter: RateLimiter;
  private logger: pino.Logger;

  constructor(apiKey: string, organization?: string) {
    this.client = new OpenAI({
      apiKey,
      organization
    });
    this.rateLimiter = initializeRateLimiter();
    this.logger = logger.child({ service: 'OpenAIClient' });
  }

  public get audio() {
    return this.client.audio;
  }

  // Add chat completions access
  public get chat() {
    return this.client.chat;
  }

  /**
   * Executes API requests with retry logic and monitoring
   * @param operation - Async function to execute
   * @returns Promise resolving to operation result
   * @throws Error if operation fails after max retries
   */
  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < MAX_RETRIES) {
      try {
        // Check rate limit before proceeding
        const remainingRequests = await this.rateLimiter.removeTokens(1);
        if (remainingRequests < 0) {
          throw new Error('Rate limit exceeded');
        }

        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        // Log performance metrics
        this.logger.info({
          event: 'api_request',
          duration,
          attempt: attempts + 1,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts < MAX_RETRIES) {
          // Exponential backoff with jitter
          const backoff = Math.min(1000 * Math.pow(2, attempts), 10000);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, backoff + jitter));
        }

        this.logger.warn({
          event: 'api_retry',
          error: lastError.message,
          attempt: attempts,
        });
      }
    }

    this.logger.error({
      event: 'api_failure',
      error: lastError?.message,
      attempts,
    });

    throw new Error(`Operation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Creates a chat completion with retry and monitoring
   * @param params - Chat completion parameters
   * @returns Promise resolving to chat completion response
   */
  async createChatCompletion(params: Parameters<OpenAI['chat']['completions']['create']>[0]) {
    return this.executeWithRetry(() => this.client.chat.completions.create({
      ...params,
      model: params.model || DEFAULT_MODEL,
      temperature: params.temperature || DEFAULT_TEMPERATURE,
      max_tokens: params.max_tokens || DEFAULT_MAX_TOKENS,
    }));
  }
}

// Create and export configured OpenAI client instance
const config = createOpenAIConfig();
export const openai = new OpenAIClient(config.apiKey, config.organization);

// Export the type of our configured client
export type ConfiguredOpenAI = OpenAI;

// Export the configured instance
export const openaiInstance = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
