/**
 * @fileoverview Enhanced quiz generator module for membo.ai learning system.
 * Implements AI-powered quiz generation with performance monitoring and caching.
 * @version 1.0.0
 */

import { openai } from '../../config/openai';
import { ICard, ICardContent, ContentType } from '../../interfaces/ICard';
import { StudyModes } from '../../constants/studyModes';
import NodeCache from 'node-cache';
import { PerformanceMonitor } from 'performance-monitor';

// Quiz generation constants
const QUIZ_GENERATION_PROMPT = `Generate a comprehensive quiz based on the following content. 
Include a mix of question types (multiple choice, true/false, fill in blank) that test understanding 
and recall. Ensure questions are clear, unambiguous, and have definitive correct answers.`;

const MAX_OPTIONS_COUNT = 4;
const MIN_OPTIONS_COUNT = 2;
const QUIZ_TYPES = ['multiple_choice', 'true_false', 'fill_in_blank'] as const;
const PROCESSING_TIMEOUT = 10000; // 10 seconds
const CACHE_TTL = 3600; // 1 hour
const MAX_RETRIES = 3;

type QuizType = typeof QUIZ_TYPES[number];

interface QuizGeneratorOptions {
  maxQuestionsPerContent?: number;
  preferredQuizTypes?: QuizType[];
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  timeout?: number;
}

interface QuizQuestion {
  question: string;
  type: QuizType;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

/**
 * Enhanced quiz generator class with performance monitoring and caching
 */
export class QuizGenerator {
  private readonly openaiClient;
  private readonly cache: NodeCache;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly options: Required<QuizGeneratorOptions>;

  constructor(
    openaiClient = openai,
    cacheService = new NodeCache({ stdTTL: CACHE_TTL }),
    performanceMonitor = new PerformanceMonitor(),
    options: QuizGeneratorOptions = {}
  ) {
    this.openaiClient = openaiClient;
    this.cache = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.options = {
      maxQuestionsPerContent: 10,
      preferredQuizTypes: [...QUIZ_TYPES],
      difficultyLevel: 'medium',
      timeout: PROCESSING_TIMEOUT,
      ...options
    };
  }

  /**
   * Generates quiz cards from content with performance monitoring and caching
   */
  async generateQuiz(content: string, options: Partial<QuizGeneratorOptions> = {}): Promise<ICard[]> {
    const span = this.performanceMonitor.startSpan('quiz_generation');
    const cacheKey = this.generateCacheKey(content, options);

    try {
      // Check cache first
      const cachedQuiz = this.cache.get<ICard[]>(cacheKey);
      if (cachedQuiz) {
        span.addAttribute('cache_hit', true);
        return cachedQuiz;
      }

      const mergedOptions = { ...this.options, ...options };
      const questions = await this.generateQuestions(content, mergedOptions);
      const cards = this.convertToCards(questions);

      // Cache the generated cards
      this.cache.set(cacheKey, cards);
      
      span.addAttribute('questions_count', questions.length);
      return cards;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generates a unique cache key based on content and options
   */
  private generateCacheKey(content: string, options: Partial<QuizGeneratorOptions>): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(content + JSON.stringify(options))
      .digest('hex');
    return `quiz_${hash}`;
  }

  /**
   * Generates quiz questions using OpenAI with retry mechanism
   */
  private async generateQuestions(
    content: string,
    options: Required<QuizGeneratorOptions>
  ): Promise<QuizQuestion[]> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < MAX_RETRIES) {
      try {
        const response = await this.openaiClient.createChatCompletion({
          messages: [
            { role: 'system', content: QUIZ_GENERATION_PROMPT },
            { role: 'user', content: this.buildPrompt(content, options) }
          ],
          temperature: 0.7,
          max_tokens: 2048,
          timeout: options.timeout
        });

        const questions = this.parseQuizResponse(response.data.choices[0].message?.content || '');
        return this.validateQuestions(questions);
      } catch (error) {
        lastError = error as Error;
        attempts++;
        if (attempts < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    throw new Error(`Failed to generate quiz after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Builds the prompt for quiz generation based on options
   */
  private buildPrompt(content: string, options: Required<QuizGeneratorOptions>): string {
    return `
      Content: ${content}
      
      Generate ${options.maxQuestionsPerContent} questions with the following requirements:
      - Difficulty level: ${options.difficultyLevel}
      - Question types: ${options.preferredQuizTypes.join(', ')}
      - Include explanations for correct answers
      - Multiple choice questions should have ${MIN_OPTIONS_COUNT}-${MAX_OPTIONS_COUNT} options
      
      Format: JSON array of questions with properties:
      - question: string
      - type: ${QUIZ_TYPES.join('|')}
      - options?: string[] (for multiple choice)
      - correctAnswer: string
      - explanation: string
    `;
  }

  /**
   * Parses and validates the quiz response from OpenAI
   */
  private parseQuizResponse(response: string): QuizQuestion[] {
    try {
      const questions = JSON.parse(response) as QuizQuestion[];
      return questions.filter(q => this.isValidQuestion(q));
    } catch (error) {
      throw new Error('Failed to parse quiz response');
    }
  }

  /**
   * Validates individual quiz questions
   */
  private isValidQuestion(question: QuizQuestion): boolean {
    if (!question.question || !question.type || !question.correctAnswer) {
      return false;
    }

    if (question.type === 'multiple_choice') {
      return Array.isArray(question.options) &&
        question.options.length >= MIN_OPTIONS_COUNT &&
        question.options.length <= MAX_OPTIONS_COUNT &&
        question.options.includes(question.correctAnswer);
    }

    return true;
  }

  /**
   * Validates the complete set of generated questions
   */
  private validateQuestions(questions: QuizQuestion[]): QuizQuestion[] {
    if (questions.length === 0) {
      throw new Error('No valid questions generated');
    }
    return questions;
  }

  /**
   * Converts quiz questions to card format
   */
  private convertToCards(questions: QuizQuestion[]): ICard[] {
    return questions.map((question, index) => ({
      id: `quiz_${Date.now()}_${index}`,
      userId: '', // To be filled by the calling service
      contentId: '', // To be filled by the calling service
      frontContent: this.createCardContent(this.formatQuestion(question)),
      backContent: this.createCardContent(this.formatAnswer(question)),
      fsrsData: {
        stability: 0,
        difficulty: 0,
        reviewCount: 0,
        lastReview: new Date(),
        lastRating: 0
      },
      nextReview: new Date(),
      compatibleModes: [StudyModes.QUIZ],
      tags: ['quiz'],
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Creates card content with appropriate formatting
   */
  private createCardContent(text: string): ICardContent {
    return {
      text,
      type: ContentType.MARKDOWN,
      metadata: {
        aiGenerated: true,
        generationPrompt: QUIZ_GENERATION_PROMPT,
        lastModifiedBy: 'QuizGenerator',
      }
    };
  }

  /**
   * Formats the question for card front
   */
  private formatQuestion(question: QuizQuestion): string {
    let formattedQuestion = `# ${question.question}\n\n`;
    
    if (question.type === 'multiple_choice' && question.options) {
      formattedQuestion += question.options
        .map((option, index) => `${index + 1}. ${option}`)
        .join('\n');
    }
    
    return formattedQuestion;
  }

  /**
   * Formats the answer for card back
   */
  private formatAnswer(question: QuizQuestion): string {
    return `# Answer\n${question.correctAnswer}\n\n` +
      (question.explanation ? `## Explanation\n${question.explanation}` : '');
  }
}