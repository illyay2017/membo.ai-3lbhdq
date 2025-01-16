/**
 * Enum defining possible states of content processing
 * Used for real-time tracking of content status in the system
 * @version 1.0.0
 */
export enum ContentStatus {
    NEW = 'new',
    PROCESSING = 'processing',
    PROCESSED = 'processed',
    ARCHIVED = 'archived',
    ERROR = 'error'
}

/**
 * Enum defining supported content source types
 * Used to identify the origin of captured content
 * @version 1.0.0
 */
export enum ContentSource {
    WEB = 'web',
    PDF = 'pdf',
    KINDLE = 'kindle',
    MANUAL = 'manual'
}

/**
 * Interface defining comprehensive metadata structure for content items
 * Includes source-specific fields and capture context
 * @version 1.0.0
 */
export interface ContentMetadata {
    /** Title of the content source (e.g., webpage title, PDF name) */
    readonly title: string | null;
    
    /** Author of the content if available */
    readonly author: string | null;
    
    /** Immutable array of tags associated with the content */
    readonly tags: readonly string[];
    
    /** Source type of the content */
    readonly source: ContentSource;
    
    /** Original URL for web content or file location */
    readonly sourceUrl: string | null;
    
    /** Page number for PDF or Kindle content */
    readonly pageNumber: number | null;
    
    /** Chapter or section title for structured content */
    readonly chapterTitle: string | null;
    
    /** Additional context about the captured content */
    readonly captureContext: {
        /** Section or container where content was captured */
        section?: string;
        /** Original highlighted text if applicable */
        highlight?: string;
        /** User notes added during capture */
        notes?: string;
    };
}

/**
 * Main interface representing captured content items
 * Includes comprehensive tracking and error handling
 * @version 1.0.0
 */
export interface Content {
    /** Unique identifier for the content item */
    readonly id: string;
    
    /** ID of the user who created the content */
    readonly userId: string;
    
    /** The actual captured content text */
    readonly content: string;
    
    /** Immutable metadata about the content */
    readonly metadata: Readonly<ContentMetadata>;
    
    /** Current processing status */
    readonly status: ContentStatus;
    
    /** Creation timestamp */
    readonly createdAt: Date;
    
    /** Last update timestamp */
    readonly updatedAt: Date;
    
    /** Timestamp when processing completed, if applicable */
    readonly processedAt: Date | null;
    
    /** Error details if processing failed */
    readonly processingError: {
        code: string;
        message: string;
    } | null;
}

/**
 * Input type for content creation operations
 * Allows flexible metadata with optional tags
 * @version 1.0.0
 */
export type ContentCreateInput = {
    /** Content text to be captured */
    content: string;
    
    /** Metadata with optional tags */
    metadata: Omit<ContentMetadata, 'tags'> & { tags?: string[] };
};

/**
 * Input type for content update operations
 * Supports partial metadata updates
 * @version 1.0.0
 */
export type ContentUpdateInput = {
    /** Updated content text */
    content: string;
    
    /** Partial metadata updates */
    metadata: Partial<ContentMetadata>;
    
    /** New status if being updated */
    status: ContentStatus;
};