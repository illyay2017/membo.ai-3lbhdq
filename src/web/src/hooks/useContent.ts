/**
 * @fileoverview Custom React hook for managing content operations and state in the web client.
 * Provides an abstraction layer over content store and services with reactive updates,
 * optimistic updates, offline support, and real-time synchronization.
 * @version 1.0.0
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Content, ContentCreateInput, ContentUpdateInput, ContentStatus } from '../types/content';
import { useContentStore } from '../store/contentStore';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Enum defining possible sync states for content operations
 */
enum SyncStatus {
  SYNCED = 'synced',
  SYNCING = 'syncing',
  PENDING = 'pending',
  ERROR = 'error'
}

/**
 * Interface for offline operation queue item
 */
interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'process' | 'archive';
  data?: ContentCreateInput | ContentUpdateInput;
  timestamp: number;
  retryCount: number;
}

/**
 * Custom hook for content management with offline support and real-time sync
 * @returns Content management state and operations
 */
export const useContent = () => {
  // Access content store state and actions
  const {
    contents,
    isLoading,
    filters,
    fetchContents,
    addContent,
    updateContent: storeUpdateContent,
    removeContent,
    processContent: storeProcessContent,
    archiveContent: storeArchiveContent,
    setFilters,
    syncContent,
  } = useContentStore();

  // Initialize WebSocket connection for real-time updates
  const ws = useWebSocket(localStorage.getItem('authToken') || '', {
    autoReconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
  });

  // Memoized sorted and filtered content
  const sortedContents = useMemo(() => {
    return [...contents].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [contents]);

  /**
   * Create new content with optimistic updates and offline support
   */
  const createContent = useCallback(async (input: ContentCreateInput): Promise<Content> => {
    try {
      const createdContent = await addContent(input);
      ws.send('content_created', { id: createdContent.id });
      return createdContent;
    } catch (error) {
      console.error('Failed to create content:', error);
      throw error;
    }
  }, [addContent, ws]);

  /**
   * Update existing content with optimistic updates and conflict resolution
   */
  const updateContent = useCallback(async (
    id: string,
    input: ContentUpdateInput
  ): Promise<Content> => {
    try {
      const updatedContent = await storeUpdateContent(id, input);
      ws.send('content_updated', { id, changes: input });
      return updatedContent;
    } catch (error) {
      console.error('Failed to update content:', error);
      throw error;
    }
  }, [storeUpdateContent, ws]);

  /**
   * Delete content with optimistic updates and rollback support
   */
  const deleteContent = useCallback(async (id: string): Promise<void> => {
    try {
      await removeContent(id);
      ws.send('content_deleted', { id });
    } catch (error) {
      console.error('Failed to delete content:', error);
      throw error;
    }
  }, [removeContent, ws]);

  /**
   * Process content for card generation with progress tracking
   */
  const processContent = useCallback(async (id: string): Promise<Content> => {
    try {
      const processedContent = await storeProcessContent(id);
      ws.send('content_processed', { id });
      return processedContent;
    } catch (error) {
      console.error('Failed to process content:', error);
      throw error;
    }
  }, [storeProcessContent, ws]);

  /**
   * Archive content with optimistic updates
   */
  const archiveContent = useCallback(async (id: string): Promise<Content> => {
    try {
      const archivedContent = await storeArchiveContent(id);
      ws.send('content_archived', { id });
      return archivedContent;
    } catch (error) {
      console.error('Failed to archive content:', error);
      throw error;
    }
  }, [storeArchiveContent, ws]);

  /**
   * Retry failed operations from offline queue
   */
  const retryFailedOperations = useCallback(async (): Promise<void> => {
    try {
      await syncContent();
    } catch (error) {
      console.error('Failed to retry operations:', error);
      throw error;
    }
  }, [syncContent]);

  // Setup WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!ws.isConnected) return;

    const handleContentUpdate = (data: any) => {
      fetchContents(filters);
    };

    ws.subscribe('content_updated', handleContentUpdate);
    ws.subscribe('content_processed', handleContentUpdate);
    ws.subscribe('content_archived', handleContentUpdate);
    ws.subscribe('content_deleted', handleContentUpdate);

    return () => {
      ws.unsubscribe('content_updated', handleContentUpdate);
      ws.unsubscribe('content_processed', handleContentUpdate);
      ws.unsubscribe('content_archived', handleContentUpdate);
      ws.unsubscribe('content_deleted', handleContentUpdate);
    };
  }, [ws.isConnected, filters, fetchContents, ws]);

  // Initial content fetch
  useEffect(() => {
    fetchContents(filters);
  }, [fetchContents, filters]);

  return {
    // State
    contents: sortedContents,
    isLoading,
    syncStatus: ws.isConnected ? SyncStatus.SYNCED : SyncStatus.PENDING,
    connectionQuality: ws.connectionQuality,

    // Content operations
    createContent,
    updateContent,
    deleteContent,
    processContent,
    archiveContent,

    // Filters and sync
    setFilters,
    retryFailedOperations,
  };
};