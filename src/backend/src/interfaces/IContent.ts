/**
 * @fileoverview Interface definitions for content items in the membo.ai learning system.
 * Defines the structure and properties of content captured from various sources like
 * web highlights, PDFs, and Kindle for processing and management.
 * @version 1.0.0
 */

/**
 * Enum representing the possible processing states of content items
 */
export enum ContentStatus {
    NEW = 'new',           // Freshly captured content
    PROCESSING = 'processing', // Content currently being processed by AI
    PROCESSED = 'processed',   // Successfully processed content
    ARCHIVED = 'archived',     // Content that has been archived
    ERROR = 'error'           // Content that failed processing
}

/**
 * Metadata structure for content items
 */
interface ContentMetadata {
    contentType?: string;      // Type of content (text, pdf, kindle, etc.)
    language?: string;         // Detected content language
    tags?: string[];          // User-defined or auto-generated tags
    wordCount?: number;       // Number of words in content
    readingTime?: number;     // Estimated reading time in minutes
    confidence?: number;      // AI processing confidence score
    [key: string]: any;      // Additional flexible metadata fields
}

/**
 * Interface defining the structure of content items in the system
 */
export interface IContent {
    /**
     * Unique identifier for the content item
     */
    id: string;

    /**
     * ID of the user who owns this content
     */
    userId: string;

    /**
     * The actual content text or data
     */
    content: string;

    /**
     * Additional metadata about the content
     */
    metadata: ContentMetadata;

    /**
     * Source type (e.g., 'web', 'pdf', 'kindle')
     */
    source: string;

    /**
     * Optional URL where the content was captured from
     */
    sourceUrl: string | null;

    /**
     * Current processing status of the content
     */
    status: ContentStatus;

    /**
     * Timestamp when the content was created
     */
    createdAt: Date;

    /**
     * Timestamp of last content update
     */
    updatedAt: Date;

    /**
     * Timestamp when content was successfully processed
     * Null if not yet processed or processing failed
     */
    processedAt: Date | null;
}