/**
 * @fileoverview Service layer for handling content-related operations in the web client
 * Implements content capture, processing, and management with enhanced error handling
 * and performance optimizations.
 * @version 1.0.0
 */

import { Content, ContentStatus, ContentCreateInput, ContentUpdateInput } from '../types/content';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../constants/api';

/**
 * Error class for content-related operations
 */
class ContentError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

/**
 * Interface for content filtering options
 */
interface ContentFilters {
  status?: ContentStatus[];
  source?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for processing options
 */
interface ProcessingOptions {
  priority?: 'high' | 'normal' | 'low';
  generateCards?: boolean;
  aiModel?: string;
  maxRetries?: number;
}

/**
 * Service object for managing content operations
 */
export const contentService = {
  /**
   * Retrieves all content items with pagination and filtering
   */
  async getAllContent(
    filters: ContentFilters = {},
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<{ items: Content[]; total: number }> {
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(pagination.sortBy && { sortBy: pagination.sortBy }),
        ...(pagination.sortOrder && { sortOrder: pagination.sortOrder }),
        ...(filters.status && { status: filters.status.join(',') }),
        ...(filters.source && { source: filters.source.join(',') }),
        ...(filters.tags && { tags: filters.tags.join(',') }),
        ...(filters.dateRange && {
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString(),
        }),
      });

      return await api.get(`${API_ENDPOINTS.CONTENT.BASE}?${queryParams}`);
    } catch (error: any) {
      throw new ContentError(
        'Failed to retrieve content items',
        'FETCH_ERROR',
        error
      );
    }
  },

  /**
   * Retrieves a single content item by ID
   */
  async getContentById(id: string): Promise<Content> {
    try {
      return await api.get(`${API_ENDPOINTS.CONTENT.BASE}/${id}`);
    } catch (error: any) {
      throw new ContentError(
        'Failed to retrieve content item',
        'FETCH_ERROR',
        error
      );
    }
  },

  /**
   * Creates a new content item
   */
  async createContent(input: ContentCreateInput): Promise<Content> {
    try {
      return await api.post(API_ENDPOINTS.CONTENT.BASE, input);
    } catch (error: any) {
      throw new ContentError(
        'Failed to create content item',
        'CREATE_ERROR',
        error
      );
    }
  },

  /**
   * Updates an existing content item
   */
  async updateContent(id: string, input: ContentUpdateInput): Promise<Content> {
    try {
      return await api.put(`${API_ENDPOINTS.CONTENT.BASE}/${id}`, input);
    } catch (error: any) {
      throw new ContentError(
        'Failed to update content item',
        'UPDATE_ERROR',
        error
      );
    }
  },

  /**
   * Deletes a content item
   */
  async deleteContent(id: string): Promise<void> {
    try {
      await api.delete(`${API_ENDPOINTS.CONTENT.BASE}/${id}`);
    } catch (error: any) {
      throw new ContentError(
        'Failed to delete content item',
        'DELETE_ERROR',
        error
      );
    }
  },

  /**
   * Processes content for card generation with enhanced error handling and retry logic
   */
  async processContent(
    id: string,
    options: ProcessingOptions = {}
  ): Promise<Content> {
    try {
      const response = await api.post(`${API_ENDPOINTS.CONTENT.PROCESS}/${id}`, {
        priority: options.priority || 'normal',
        generateCards: options.generateCards ?? true,
        aiModel: options.aiModel,
        maxRetries: options.maxRetries || 3,
      });

      return response;
    } catch (error: any) {
      throw new ContentError(
        'Failed to process content',
        'PROCESSING_ERROR',
        error
      );
    }
  },

  /**
   * Archives a content item
   */
  async archiveContent(id: string): Promise<Content> {
    try {
      return await api.post(`${API_ENDPOINTS.CONTENT.ARCHIVE}/${id}`);
    } catch (error: any) {
      throw new ContentError(
        'Failed to archive content',
        'ARCHIVE_ERROR',
        error
      );
    }
  },

  /**
   * Processes multiple content items in batch with optimized performance
   */
  async batchProcess(
    ids: string[],
    options: ProcessingOptions = {}
  ): Promise<{ successful: Content[]; failed: ContentError[] }> {
    try {
      const response = await api.post(API_ENDPOINTS.CONTENT.BATCH, {
        ids,
        options: {
          priority: options.priority || 'normal',
          generateCards: options.generateCards ?? true,
          aiModel: options.aiModel,
          maxRetries: options.maxRetries || 3,
        },
      });

      return response;
    } catch (error: any) {
      throw new ContentError(
        'Failed to process content batch',
        'BATCH_PROCESSING_ERROR',
        error
      );
    }
  },
};