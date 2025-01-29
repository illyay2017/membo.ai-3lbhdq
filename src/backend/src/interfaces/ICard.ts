/**
 * @fileoverview Defines the core interfaces for flashcard data structures in the membo.ai learning system.
 * Supports AI-powered card generation, FSRS algorithm implementation, and multiple study modes.
 * @version 1.0.0
 */

import { StudyModes } from '../constants/studyModes';

/**
 * Enum defining possible content types for card front and back content
 */
export enum ContentType {
    TEXT = 'text',
    HTML = 'html',
    MARKDOWN = 'markdown',
    LATEX = 'latex',
    CODE = 'code'
}

/**
 * Interface defining metadata for card content
 */
export interface IContentMetadata {
    sourceUrl?: string;
    sourcePage?: number;
    sourcePosition?: {
        start: number;
        end: number;
    };
    languageCode?: string;
    codeLanguage?: string;
    aiGenerated: boolean;
    generationPrompt?: string;
    lastModifiedBy: string;
}

/**
 * Interface defining the structure of card content including type and metadata
 */
export interface ICardContent {
    text: string;
    type: ContentType;
    metadata: IContentMetadata;
}

/**
 * Interface defining the Free Spaced Repetition Scheduler data structure
 * for optimized review scheduling
 */
export interface IFSRSData {
    stability: number;
    difficulty: number;
    reviewCount: number;
    lastReview: Date | null;
    lastRating: number;
}

/**
 * Primary interface defining the structure of a flashcard with comprehensive
 * support for AI processing, FSRS algorithm, and multiple study modes
 */
export interface ICard {
    /** Unique identifier for the card */
    id: string;

    /** Reference to the card owner */
    userId: string;

    /** Reference to the original content source */
    contentId: string;

    /** Front side content of the card */
    frontContent: ICardContent;

    /** Back side content of the card */
    backContent: ICardContent;

    /** FSRS algorithm data for spaced repetition */
    fsrsData: {
        stability: number;
        difficulty: number;
        reviewCount: number;
        lastReview: Date | null;
        lastRating: number;
    };

    /** Next scheduled review date */
    nextReview: Date;

    /** Study modes compatible with this card */
    compatibleModes: string[];

    /** Organizational and searchable tags */
    tags: string[];

    /** Card creation timestamp */
    createdAt: Date;
}
