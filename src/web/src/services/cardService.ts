/**
 * Service layer for managing flashcard operations including AI-powered card generation,
 * FSRS-based study scheduling, and multi-mode study features.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.2
import { fsrs } from '@fsrs/core'; // v1.0.0
import { api } from '../lib/api';
import { Card, CardContent, FSRSData } from '../types/card';
import { STUDY_MODES, FSRS_CONFIG } from '../constants/study';
import { validateRegistrationData } from '../../utils/validation';
import { UserRole } from '@shared/types/userRoles';
// test

// API endpoints for card operations
const API_ENDPOINTS = {
  CARDS: '/api/v1/cards',
  CARD_BY_ID: '/api/v1/cards/{id}',
  DUE_CARDS: '/api/v1/cards/due',
  STUDY_RESULT: '/api/v1/cards/{id}/study',
  AI_GENERATE: '/api/v1/cards/generate',
  VOICE_SESSION: '/api/v1/study/voice'
} as const;

// AI quota limits by user role
const AI_QUOTAS = {
  [UserRole.FREE_USER]: 10,
  [UserRole.PRO_USER]: 100,
  [UserRole.POWER_USER]: -1,
  [UserRole.ENTERPRISE_ADMIN]: -1,
  [UserRole.SYSTEM_ADMIN]: -1
} as const;

// Validation schemas for card operations
const cardCreateSchema = z.object({
  frontContent: z.object({
    text: z.string().min(1),
    type: z.enum(['text', 'markdown', 'html', 'code']),
    metadata: z.object({
      aiModel: z.string().optional(),
      generationPrompt: z.string().optional(),
      confidence: z.number().optional(),
      processingTime: z.number().optional()
    }).optional()
  }),
  backContent: z.object({
    text: z.string().min(1),
    type: z.enum(['text', 'markdown', 'html', 'code']),
    metadata: z.object({
      aiModel: z.string().optional(),
      generationPrompt: z.string().optional(),
      confidence: z.number().optional(),
      processingTime: z.number().optional()
    }).optional()
  }),
  tags: z.array(z.string()).optional(),
  compatibleModes: z.array(z.enum([STUDY_MODES.STANDARD, STUDY_MODES.VOICE, STUDY_MODES.QUIZ]))
});

/**
 * Initializes FSRS data for a new card
 */
function initializeFSRSData(): FSRSData {
  return {
    stability: FSRS_CONFIG.initialInterval,
    difficulty: 1.0,
    reviewCount: 0,
    lastReview: new Date(),
    lastRating: 0,
    performanceHistory: []
  };
}

/**
 * Service object containing card management and study functionality
 */
export const cardService = {
  /**
   * Creates a new flashcard with optional AI processing
   */
  async createCard(cardData: z.infer<typeof cardCreateSchema>): Promise<Card> {
    const validatedData = cardCreateSchema.parse(cardData);
    const fsrsData = initializeFSRSData();

    const response = await api.post<Card>(API_ENDPOINTS.CARDS, {
      ...validatedData,
      fsrsData
    });
    return response.data;
  },

  /**
   * Retrieves cards based on query parameters
   */
  async getCards(params: { 
    limit?: number; 
    offset?: number; 
    tags?: string[]; 
    studyMode?: STUDY_MODES 
  }): Promise<{ cards: Card[]; total: number }> {
    const response = await api.get(API_ENDPOINTS.CARDS, { params });
    return response.data;
  },

  /**
   * Retrieves a specific card by ID
   */
  async getCardById(id: string): Promise<Card> {
    const response = await api.get<Card>(API_ENDPOINTS.CARD_BY_ID.replace('{id}', id));
    return response.data;
  },

  /**
   * Updates an existing card
   */
  async updateCard(id: string, updates: Partial<Card>): Promise<Card> {
    const response = await api.put<Card>(
      API_ENDPOINTS.CARD_BY_ID.replace('{id}', id),
      updates
    );
    return response;
  },

  /**
   * Deletes a card
   */
  async deleteCard(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.CARD_BY_ID.replace('{id}', id));
  },

  /**
   * Retrieves the next set of due cards for study
   */
  async getNextDueCards(params: {
    limit: number;
    studyMode: STUDY_MODES;
  }): Promise<Card[]> {
    const response = await api.get<Card[]>(API_ENDPOINTS.DUE_CARDS, { params });
    return response;
  },

  /**
   * Records the result of a study session for a card
   */
  async recordStudyResult(id: string, result: {
    rating: number;
    studyMode: STUDY_MODES;
    responseTime: number;
  }): Promise<Card> {
    const response = await api.post<Card>(
      API_ENDPOINTS.STUDY_RESULT.replace('{id}', id),
      result
    );
    return response;
  },

  /**
   * Generates cards using AI processing
   */
  async generateAICards(content: string, options: {
    type: 'standard' | 'cloze' | 'quiz';
    count: number;
    tags?: string[];
  }): Promise<Card[]> {
    const response = await api.post<Card[]>(API_ENDPOINTS.AI_GENERATE, {
      content,
      options
    });
    return response;
  },

  /**
   * Initializes a voice-enabled study session
   */
  async startVoiceStudySession(options: {
    cardIds: string[];
    languageCode?: string;
    confidenceThreshold?: number;
  }): Promise<{
    sessionId: string;
    cards: Card[];
    voiceConfig: {
      languageCode: string;
      confidenceThreshold: number;
    };
  }> {
    const response = await api.post(API_ENDPOINTS.VOICE_SESSION, options);
    return response;
  }
};
