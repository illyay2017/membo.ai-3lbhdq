import * as React from 'react';
import { useInView } from 'react-intersection-observer'; // v9.5.2
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { cn } from '@/lib/utils';

import ContentCard from './ContentCard';
import ContentFilters from './ContentFilters';
import { useContentStore } from '../../store/contentStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Content } from '../../types/content';

interface ContentListProps {
  className?: string;
  ariaLabel?: string;
  role?: string;
}

/**
 * ContentList component displays a paginated, filterable list of captured content
 * with infinite scrolling, real-time updates, and virtualization for performance.
 */
const ContentList: React.FC<ContentListProps> = ({
  className,
  ariaLabel = 'Content list',
  role = 'feed'
}) => {
  // Store state and actions
  const { contents, isLoading, totalCount, filters, setFilters } = useContentStore();
  
  // Virtual list container ref
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Infinite scroll detection
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
    rootMargin: '100px',
  });

  // Virtual list for performance optimization
  const rowVirtualizer = useVirtualizer({
    count: contents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated card height
    overscan: 5,
  });

  // WebSocket connection for real-time updates
  const { connect, disconnect, subscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    { autoReconnect: true }
  );

  // Handle content updates with optimistic UI
  const handleContentUpdate = React.useCallback(async (updatedContent: Content) => {
    try {
      const originalContent = contents.find(c => c.id === updatedContent.id);
      if (!originalContent) return;

      // Optimistically update UI
      setFilters({ ...filters });

      // Handle error by reverting to original state
      const onError = () => {
        setFilters({ ...filters });
        // Show error toast/notification here
      };

      // Attempt to update content
      await useContentStore.getState().updateContent(updatedContent.id, {
        content: updatedContent.content,
        metadata: updatedContent.metadata,
        status: updatedContent.status
      });
    } catch (error) {
      console.error('Failed to update content:', error);
    }
  }, [contents, filters, setFilters]);

  // Load more content when scrolling
  const loadMoreContent = React.useCallback(async () => {
    if (isLoading || contents.length >= totalCount) return;

    try {
      await useContentStore.getState().fetchContents({
        ...filters,
        page: Math.ceil(contents.length / 20) + 1
      });
    } catch (error) {
      console.error('Failed to load more content:', error);
    }
  }, [isLoading, contents.length, totalCount, filters]);

  // Subscribe to real-time content updates
  React.useEffect(() => {
    connect();
    subscribe('content_update', handleContentUpdate);
    return () => {
      disconnect();
    };
  }, [connect, disconnect, subscribe, handleContentUpdate]);

  // Load more content when scrolling near bottom
  React.useEffect(() => {
    if (inView) {
      loadMoreContent();
    }
  }, [inView, loadMoreContent]);

  // Initial content load
  React.useEffect(() => {
    useContentStore.getState().fetchContents(filters);
  }, [filters]);

  return (
    <div className="space-y-4">
      <ContentFilters 
        className="sticky top-0 z-10 bg-background p-4 border-b"
        aria-controls="content-list"
      />

      <div
        ref={parentRef}
        className={cn(
          'relative h-[800px] overflow-auto',
          className
        )}
        id="content-list"
        role={role}
        aria-label={ariaLabel}
        aria-busy={isLoading}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const content = contents[virtualRow.index];
            return (
              <div
                key={content.id}
                ref={virtualRow.index === contents.length - 1 ? loadMoreRef : undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <ContentCard
                  content={content}
                  onUpdate={handleContentUpdate}
                  className="h-full"
                  showActions
                />
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div 
            className="flex justify-center p-4"
            role="status"
            aria-label="Loading more content"
          >
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!isLoading && contents.length === 0 && (
          <div 
            className="flex flex-col items-center justify-center p-8 text-center text-gray-500"
            role="status"
            aria-label="No content found"
          >
            <p>No content found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentList;