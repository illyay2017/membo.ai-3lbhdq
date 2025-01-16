import { v4 as uuidv4 } from 'uuid'; // v9.0.x
import { 
    Content, 
    ContentMetadata, 
    ContentSource, 
    ContentStatus 
} from '../../src/types/content';

// Constants for content validation and processing
const MAX_CONTENT_LENGTH = 10000;
const MIN_CONTENT_LENGTH = 1;
const SURROUNDING_CONTEXT_LENGTH = 100;

/**
 * Captures the currently selected text from the webpage
 * Handles RTL text, accessibility, and edge cases
 * @returns {string} The cleaned and processed selected text
 * @throws {Error} If selection cannot be accessed
 */
export const captureSelectedText = (): string => {
    try {
        const selection = window.getSelection();
        if (!selection) {
            throw new Error('No text selection available');
        }

        // Get selection range and validate
        const range = selection.getRangeAt(0);
        if (!range) {
            return '';
        }

        // Extract and clean text content
        let text = range.toString()
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/[\r\n]+/g, '\n')  // Normalize line endings
            .trim();

        // Handle RTL text direction
        const container = range.commonAncestorContainer as HTMLElement;
        if (container.dir === 'rtl' || getComputedStyle(container).direction === 'rtl') {
            text = '\u202B' + text + '\u202C'; // Add RTL markers
        }

        return text;
    } catch (error) {
        console.error('Error capturing selected text:', error);
        throw error;
    }
};

/**
 * Extracts comprehensive metadata from the current webpage
 * Supports multiple metadata formats and fallback strategies
 * @returns {ContentMetadata} Object containing page metadata
 */
export const extractMetadata = (): ContentMetadata => {
    // Extract page title with fallback
    const title = document.title || 
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        null;

    // Get canonical URL with fallbacks
    const sourceUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
        document.querySelector('meta[property="og:url"]')?.getAttribute('content') ||
        window.location.href;

    // Extract author information
    const author = 
        document.querySelector('meta[name="author"]')?.getAttribute('content') ||
        document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
        document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
        null;

    // Get surrounding context of selection
    const selection = window.getSelection();
    let context = null;
    if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer as HTMLElement;
        if (container.textContent) {
            const start = Math.max(0, range.startOffset - SURROUNDING_CONTEXT_LENGTH);
            const end = Math.min(container.textContent.length, 
                               range.endOffset + SURROUNDING_CONTEXT_LENGTH);
            context = container.textContent.slice(start, end).trim();
        }
    }

    return {
        title,
        author,
        sourceUrl,
        source: ContentSource.WEB,
        tags: [],
        pageNumber: null,
        chapterTitle: null,
        captureContext: {
            section: document.querySelector('h1, h2, h3')?.textContent?.trim() || undefined,
            highlight: selection?.toString().trim(),
            context: context || undefined
        }
    };
};

/**
 * Prepares captured content and metadata for storage
 * Performs validation and processing before storage
 * @param selectedText The captured text content
 * @param metadata The extracted metadata
 * @returns {Content} Prepared content object
 * @throws {Error} If content validation fails
 */
export const prepareContentInput = (
    selectedText: string,
    metadata: ContentMetadata
): Content => {
    if (!selectedText || selectedText.length < MIN_CONTENT_LENGTH) {
        throw new Error('Selected text is empty or too short');
    }

    if (selectedText.length > MAX_CONTENT_LENGTH) {
        throw new Error('Selected text exceeds maximum length');
    }

    const content: Content = {
        id: uuidv4(),
        userId: '', // Set by the auth context when saving
        content: selectedText,
        metadata: {
            ...metadata,
            tags: [], // Tags are managed separately
        },
        status: ContentStatus.NEW,
        createdAt: new Date(),
        updatedAt: new Date(),
        processedAt: null,
        processingError: null
    };

    if (!validateContent(content)) {
        throw new Error('Content validation failed');
    }

    return content;
};

/**
 * Validates content object before storage
 * Performs comprehensive validation of content and metadata
 * @param content The content object to validate
 * @returns {boolean} True if content is valid
 */
export const validateContent = (content: Content): boolean => {
    try {
        // Validate content length
        if (!content.content || 
            content.content.length < MIN_CONTENT_LENGTH || 
            content.content.length > MAX_CONTENT_LENGTH) {
            return false;
        }

        // Validate required metadata
        if (!content.metadata.source || 
            !content.metadata.sourceUrl) {
            return false;
        }

        // Validate content format
        if (!/^[\x20-\x7E\s\u0080-\uFFFF]*$/.test(content.content)) {
            return false;
        }

        // Validate timestamps
        if (!(content.createdAt instanceof Date) || 
            !(content.updatedAt instanceof Date)) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Content validation error:', error);
        return false;
    }
};