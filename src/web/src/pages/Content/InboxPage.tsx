import * as React from 'react';
import { useEffect } from 'react';
import { useErrorBoundary } from 'react-error-boundary';

import ContentList from '../../components/content/ContentList';
import { useContentStore } from '../../store/contentStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Content } from '../../types/content';

/**
 * InboxPage component displays the user's content inbox with real-time updates,
 * infinite scrolling, and enhanced error handling.
 */
const InboxPage: React.FC = () => {
  // Global state and error handling
  const { contents, isLoading, error, fetchContents } = useContentStore();
  const { showBoundary } = useErrorBoundary();

  // WebSocket connection for real-time updates
  const { connect, disconnect, subscribe } = useWebSocket(
    localStorage.getItem('authToken') || '',
    { autoReconnect: true }
  );

  // Handle real-time content updates
  const handleContentUpdate = React.useCallback((updatedContent: Content) => {
    try {
      useContentStore.getState().fetchContents();
    } catch (error) {
      console.error('Failed to handle content update:', error);
    }
  }, []);

  // Initialize content and WebSocket connection
  useEffect(() => {
    const initializeInbox = async () => {
      try {
        // Connect WebSocket
        await connect();
        subscribe('content_update', handleContentUpdate);

        // Fetch initial content
        await fetchContents();
      } catch (error) {
        showBoundary(error);
      }
    };

    initializeInbox();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect, subscribe, fetchContents, handleContentUpdate, showBoundary]);

  // Handle load more content
  const handleLoadMore = React.useCallback(async () => {
    try {
      await useContentStore.getState().fetchContents({
        page: Math.ceil(contents.length / 20) + 1
      });
    } catch (error) {
      console.error('Failed to load more content:', error);
    }
  }, [contents.length]);

  // Handle critical errors
  if (error) {
    throw new Error(error);
  }

  return (
    <main 
      className="container mx-auto px-4 py-8 sm:px-6 lg:px-8"
      role="main"
      aria-busy={isLoading}
    >
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Content Inbox
        </h1>
        <p className="mt-2 text-muted-foreground">
          Process your captured content into flashcards
        </p>
      </div>

      {/* Content List */}
      <div className="space-y-4">
        <ContentList
          className="rounded-lg border bg-card"
          ariaLabel="Content inbox list"
          role="feed"
          onLoadMore={handleLoadMore}
          hasMore={contents.length > 0 && !isLoading}
        />

        {/* Empty State */}
        {!isLoading && contents.length === 0 && (
          <div 
            className="text-center py-8 text-muted-foreground"
            role="status"
            aria-label="No content found"
          >
            <p>No content found in your inbox.</p>
            <p className="mt-2">
              Use the Chrome extension to capture content from the web.
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

export default InboxPage;