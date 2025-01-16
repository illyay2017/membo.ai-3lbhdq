/**
 * Type definitions for flashcard data structures in the web client
 * Implements comprehensive card content, FSRS data, and study mode compatibility
 * @version 1.0.0
 */

import { STUDY_MODES } from '../constants/study';

/**
 * Core interface defining the structure of a flashcard
 * Includes comprehensive metadata and study mode support
 */
export interface Card {
    id: string;
    userId: string;
    contentId: string;
    frontContent: CardContent;
    backContent: CardContent;
    fsrsData: FSRSData;
    nextReview: Date;
    compatibleModes: STUDY_MODES[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Supported content types for card content
 */
export enum ContentType {
    TEXT = 'text',
    MARKDOWN = 'markdown',
    HTML = 'html',
    CODE = 'code'
}

/**
 * Interface defining the structure of card content
 * Includes AI generation metadata and source tracking
 */
export interface CardContent {
    text: string;
    type: ContentType;
    metadata: ContentMetadata;
    sourceUrl: string;
    aiGenerated: boolean;
}

/**
 * Interface defining metadata structure for AI-generated content
 * Tracks AI model details and generation performance metrics
 */
export interface ContentMetadata {
    aiModel: string;
    generationPrompt: string;
    confidence: number;
    processingTime: number;
}

/**
 * Interface defining the FSRS algorithm data structure
 * Implements comprehensive performance tracking and review history
 */
export interface FSRSData {
    stability: number;
    difficulty: number;
    reviewCount: number;
    lastReview: Date;
    lastRating: number;
    performanceHistory: ReviewHistory[];
}

/**
 * Interface defining the structure of historical review data
 * Captures detailed analytics for each review session
 */
export interface ReviewHistory {
    timestamp: Date;
    rating: number;
    studyMode: STUDY_MODES;
    responseTime: number;
}