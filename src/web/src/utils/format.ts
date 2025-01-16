/**
 * Utility functions for formatting data types across the membo.ai web application
 * Implements consistent display formatting with accessibility and i18n support
 * @version 1.0.0
 */

import { truncate } from 'lodash'; // v4.17.21
import DOMPurify from 'dompurify'; // v3.0.1
import { marked } from 'marked'; // v5.0.2

import { Card, ContentType } from '../types/card';
import { Content, ContentSource, ContentStatus } from '../types/content';
import { formatDate } from './date';

// Types for formatting options
interface FormatOptions {
  voiceMode?: boolean;
  maxLength?: number;
  locale?: string;
  isRTL?: boolean;
  accessibility?: {
    ariaLabel?: string;
    role?: string;
  };
}

interface PreviewOptions {
  truncateLength?: number;
  includeSource?: boolean;
  includeStatus?: boolean;
  deviceType?: 'mobile' | 'desktop';
}

/**
 * Formats card content for display with enhanced accessibility and voice mode support
 * @param content - Card content to format
 * @param options - Formatting options including voice mode and accessibility
 * @returns Sanitized and formatted content with accessibility metadata
 */
export const formatCardContent = (
  content: Card['frontContent'] | Card['backContent'],
  options: FormatOptions = {}
): string => {
  const {
    voiceMode = false,
    maxLength,
    locale = 'en-US',
    isRTL = false,
    accessibility = {}
  } = options;

  let formattedContent = content.text;

  // Process content based on type
  switch (content.type) {
    case ContentType.MARKDOWN:
      formattedContent = marked(content.text);
      break;
    case ContentType.HTML:
      formattedContent = DOMPurify.sanitize(content.text);
      break;
    case ContentType.CODE:
      formattedContent = `<pre><code>${DOMPurify.sanitize(content.text)}</code></pre>`;
      break;
    default:
      formattedContent = DOMPurify.sanitize(content.text);
  }

  // Apply voice mode formatting if enabled
  if (voiceMode) {
    formattedContent = formattedContent
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Apply truncation if maxLength specified
  if (maxLength && formattedContent.length > maxLength) {
    formattedContent = truncate(formattedContent, { length: maxLength });
  }

  // Add accessibility attributes
  const accessibilityAttrs = Object.entries(accessibility)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  // Apply RTL text direction if needed
  const dirAttr = isRTL ? 'dir="rtl"' : '';

  // Wrap content with accessibility and directionality
  return `<div ${accessibilityAttrs} ${dirAttr} lang="${locale}">${formattedContent}</div>`;
};

/**
 * Creates an accessible preview of captured content with source context
 * @param content - Content item to preview
 * @param options - Preview formatting options
 * @returns Formatted preview with metadata
 */
export const formatContentPreview = (
  content: Content,
  options: PreviewOptions = {}
): string => {
  const {
    truncateLength = 150,
    includeSource = true,
    includeStatus = true,
    deviceType = 'desktop'
  } = options;

  // Adjust truncation length for mobile
  const effectiveTruncateLength = deviceType === 'mobile' ? 100 : truncateLength;

  // Format the main content
  let preview = truncate(content.content, {
    length: effectiveTruncateLength,
    separator: /,? +/
  });

  // Add source context if requested
  if (includeSource && content.metadata.source) {
    const sourceText = getSourceText(content.metadata.source, content.metadata);
    preview = `${preview}\n${sourceText}`;
  }

  // Add status indicator if requested
  if (includeStatus) {
    const statusText = getStatusText(content.status);
    preview = `${preview} ${statusText}`;
  }

  return DOMPurify.sanitize(preview);
};

/**
 * Formats numbers with locale support and accessibility
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions & { locale?: string } = {}
): string => {
  const { locale = 'en-US', ...numberFormatOptions } = options;

  try {
    return new Intl.NumberFormat(locale, numberFormatOptions).format(value);
  } catch (error) {
    console.error('Number formatting error:', error);
    return value.toString();
  }
};

/**
 * Formats a decimal number as a percentage with accessibility support
 * @param value - Decimal value to format as percentage
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  const percentage = value * 100;
  const formatted = percentage.toFixed(decimals);
  
  // Add screen reader text for accessibility
  return `<span aria-label="${formatted} percent">${formatted}%</span>`;
};

// Helper function to get source context text
const getSourceText = (source: ContentSource, metadata: Content['metadata']): string => {
  switch (source) {
    case ContentSource.WEB:
      return `Source: ${metadata.title || metadata.sourceUrl || 'Web'}`;
    case ContentSource.PDF:
      return `PDF: ${metadata.title}${metadata.pageNumber ? ` (p.${metadata.pageNumber})` : ''}`;
    case ContentSource.KINDLE:
      return `Kindle: ${metadata.title}${metadata.chapterTitle ? ` - ${metadata.chapterTitle}` : ''}`;
    default:
      return 'Manual Entry';
  }
};

// Helper function to get status indicator text
const getStatusText = (status: ContentStatus): string => {
  switch (status) {
    case ContentStatus.NEW:
      return '(New)';
    case ContentStatus.PROCESSING:
      return '(Processing...)';
    case ContentStatus.PROCESSED:
      return '(Ready)';
    case ContentStatus.ARCHIVED:
      return '(Archived)';
    case ContentStatus.ERROR:
      return '(Error)';
    default:
      return '';
  }
};