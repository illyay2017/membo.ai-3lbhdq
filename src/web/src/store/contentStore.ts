/**
 * @fileoverview Zustand store for managing content state and operations in the web client
 * Implements content management with offline support, optimistic updates, and real-time sync
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Content, ContentStatus, ContentSource, ContentCreateInput, ContentUpdateInput } from '../types/content';
import { contentService } from '../services/contentService';

/**
 * Interface for content filtering options
 */
interface ContentFilters {
  status?: ContentStatus[];
  source?: ContentSource[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Interface for pagination state
 */
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Interface for offline queue item
 */
interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete' | 'process' | 'archive';
  data?: ContentCreateInput | ContentUpdateInput;
  timestamp: number;
}

/**
 * Interface defining the content store state
 */
interface ContentState {
  contents: Content[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationState;
  filters: ContentFilters;
  offlineQueue: OfflineQueueItem[];
  
  // Actions
  fetchContents: (filters?: ContentFilters) => Promise<void>;
  addContent: (input: ContentCreateInput) => Promise<Content>;
  updateContent: (id: string, input: ContentUpdateInput) => Promise<Content>;
  removeContent: (id: string) => Promise<void>;
  processContent: (id: string) => Promise<Content>;
  archiveContent: (id: string) => Promise<Content>;
  syncContent: () => Promise<void>;
  setFilters: (filters: ContentFilters) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  clearError: () => void;
}

/**
 * Create content store with persistence and dev tools
 */
export const useContentStore = create<ContentState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        contents: [],
        isLoading: false,
        error: null,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0
        },
        filters: {},
        offlineQueue: [],

        /**
         * Fetches paginated content items with applied filters
         */
        fetchContents: async (filters?: ContentFilters) => {
          set({ isLoading: true, error: null });
          try {
            const { page, pageSize } = get().pagination;
            const { items, total } = await contentService.getAllContent(
              filters || get().filters,
              { page, limit: pageSize }
            );
            set({
              contents: items,
              pagination: { ...get().pagination, total },
              filters: filters || get().filters,
              isLoading: false
            });
          } catch (error: any) {
            set({
              error: error.message || 'Failed to fetch contents',
              isLoading: false
            });
          }
        },

        /**
         * Adds new content with optimistic updates
         */
        addContent: async (input: ContentCreateInput) => {
          const tempId = `temp-${Date.now()}`;
          const optimisticContent: Content = {
            id: tempId,
            userId: 'current-user',
            content: input.content,
            metadata: { ...input.metadata, tags: input.metadata.tags || [] },
            status: ContentStatus.NEW,
            createdAt: new Date(),
            updatedAt: new Date(),
            processedAt: null,
            processingError: null,
            syncStatus: 'pending'
          };

          set({ contents: [optimisticContent, ...get().contents] });

          try {
            const createdContent = await contentService.createContent(input);
            set({
              contents: get().contents.map(c => 
                c.id === tempId ? createdContent : c
              )
            });
            return createdContent;
          } catch (error: any) {
            set({
              contents: get().contents.filter(c => c.id !== tempId),
              error: error.message || 'Failed to create content',
              offlineQueue: [...get().offlineQueue, {
                id: tempId,
                action: 'create',
                data: input,
                timestamp: Date.now()
              }]
            });
            throw error;
          }
        },

        /**
         * Updates existing content with optimistic updates
         */
        updateContent: async (id: string, input: ContentUpdateInput) => {
          const previousContent = get().contents.find(c => c.id === id);
          if (!previousContent) throw new Error('Content not found');

          set({
            contents: get().contents.map(c =>
              c.id === id ? { ...c, ...input } : c
            )
          });

          try {
            const updatedContent = await contentService.updateContent(id, input);
            set({
              contents: get().contents.map(c =>
                c.id === id ? updatedContent : c
              )
            });
            return updatedContent;
          } catch (error: any) {
            set({
              contents: get().contents.map(c =>
                c.id === id ? previousContent : c
              ),
              error: error.message || 'Failed to update content',
              offlineQueue: [...get().offlineQueue, {
                id,
                action: 'update',
                data: input,
                timestamp: Date.now()
              }]
            });
            throw error;
          }
        },

        /**
         * Removes content with optimistic deletion
         */
        removeContent: async (id: string) => {
          const previousContent = get().contents.find(c => c.id === id);
          if (!previousContent) throw new Error('Content not found');

          set({ contents: get().contents.filter(c => c.id !== id) });

          try {
            await contentService.deleteContent(id);
          } catch (error: any) {
            set({
              contents: [...get().contents, previousContent],
              error: error.message || 'Failed to delete content',
              offlineQueue: [...get().offlineQueue, {
                id,
                action: 'delete',
                timestamp: Date.now()
              }]
            });
            throw error;
          }
        },

        /**
         * Processes content for card generation
         */
        processContent: async (id: string) => {
          set({
            contents: get().contents.map(c =>
              c.id === id ? { ...c, status: ContentStatus.PROCESSING } : c
            )
          });

          try {
            const processedContent = await contentService.processContent(id);
            set({
              contents: get().contents.map(c =>
                c.id === id ? processedContent : c
              )
            });
            return processedContent;
          } catch (error: any) {
            set({
              contents: get().contents.map(c =>
                c.id === id ? { ...c, status: ContentStatus.ERROR } : c
              ),
              error: error.message || 'Failed to process content',
              offlineQueue: [...get().offlineQueue, {
                id,
                action: 'process',
                timestamp: Date.now()
              }]
            });
            throw error;
          }
        },

        /**
         * Archives content with optimistic update
         */
        archiveContent: async (id: string) => {
          const previousContent = get().contents.find(c => c.id === id);
          if (!previousContent) throw new Error('Content not found');

          set({
            contents: get().contents.map(c =>
              c.id === id ? { ...c, status: ContentStatus.ARCHIVED } : c
            )
          });

          try {
            const archivedContent = await contentService.archiveContent(id);
            set({
              contents: get().contents.map(c =>
                c.id === id ? archivedContent : c
              )
            });
            return archivedContent;
          } catch (error: any) {
            set({
              contents: get().contents.map(c =>
                c.id === id ? previousContent : c
              ),
              error: error.message || 'Failed to archive content',
              offlineQueue: [...get().offlineQueue, {
                id,
                action: 'archive',
                timestamp: Date.now()
              }]
            });
            throw error;
          }
        },

        /**
         * Synchronizes offline queue with server
         */
        syncContent: async () => {
          const { offlineQueue } = get();
          if (offlineQueue.length === 0) return;

          set({ isLoading: true, error: null });

          try {
            for (const item of offlineQueue) {
              switch (item.action) {
                case 'create':
                  await contentService.createContent(item.data as ContentCreateInput);
                  break;
                case 'update':
                  await contentService.updateContent(item.id, item.data as ContentUpdateInput);
                  break;
                case 'delete':
                  await contentService.deleteContent(item.id);
                  break;
                case 'process':
                  await contentService.processContent(item.id);
                  break;
                case 'archive':
                  await contentService.archiveContent(item.id);
                  break;
              }
            }
            set({ offlineQueue: [], isLoading: false });
            await get().fetchContents();
          } catch (error: any) {
            set({
              error: error.message || 'Failed to sync content',
              isLoading: false
            });
          }
        },

        /**
         * Updates content filters
         */
        setFilters: (filters: ContentFilters) => {
          set({ filters });
        },

        /**
         * Updates pagination state
         */
        setPagination: (pagination: Partial<PaginationState>) => {
          set({
            pagination: { ...get().pagination, ...pagination }
          });
        },

        /**
         * Clears error state
         */
        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'content-store',
        partialize: (state) => ({
          filters: state.filters,
          pagination: state.pagination,
          offlineQueue: state.offlineQueue
        })
      }
    )
  )
);