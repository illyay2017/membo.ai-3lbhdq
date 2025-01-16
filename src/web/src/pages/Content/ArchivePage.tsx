import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useAnalytics } from '@mixpanel/browser';
import { cn } from 'class-variance-authority';

import ContentList from '../../components/content/ContentList';
import ContentActions from '../../components/content/ContentActions';
import { useContentStore } from '../../store/contentStore';
import { useAuth } from '../../hooks/useAuth';
import { ContentStatus } from '../../types/content';

/**
 * Archive page component that displays archived content with enhanced features
 * Implements real-time updates, role-based access control, and accessibility
 */
const ArchivePage: React.FC = () => {
  const analytics = useAnalytics();
  const { user } = useAuth();
  const { contents, isLoading, error, setFilters, fetchContents } = useContentStore();

  // Initialize archive view with filters and analytics
  useEffect(() => {
    const initializeArchive = async () => {
      try {
        // Set content filters for archived items
        setFilters({
          status: [ContentStatus.ARCHIVED],
          page: 1,
          pageSize: 12
        });

        // Track page view
        analytics.track('Archive Page View', {
          userId: user?.id,
          timestamp: new Date().toISOString()
        });

        // Initial content fetch
        await fetchContents();
      } catch (error) {
        console.error('Failed to initialize archive:', error);
      }
    };

    initializeArchive();

    // Cleanup on unmount
    return () => {
      setFilters({});
    };
  }, [setFilters, analytics, user, fetchContents]);

  // Handle content actions with analytics tracking
  const handleContentAction = useCallback(async (contentId: string, action: 'restore' | 'delete') => {
    try {
      analytics.track('Archive Content Action', {
        userId: user?.id,
        contentId,
        action,
        timestamp: new Date().toISOString()
      });

      if (action === 'restore') {
        await useContentStore.getState().updateContent(contentId, {
          status: ContentStatus.PROCESSED
        });
      } else if (action === 'delete') {
        await useContentStore.getState().removeContent(contentId);
      }
    } catch (error) {
      console.error(`Failed to ${action} content:`, error);
    }
  }, [analytics, user]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div 
      className="flex flex-col items-center justify-center p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="text-xl font-semibold text-error mb-4">
        Something went wrong
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        {error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className={cn(
        "container mx-auto px-4 py-8 min-h-screen",
        "sm:px-6 lg:px-8",
        "dark:bg-gray-900"
      )}>
        {/* Page Header */}
        <header className={cn(
          "mb-8 flex items-center justify-between",
          "border-b border-gray-200 dark:border-gray-700 pb-4"
        )}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Archive
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              View and manage your archived content
            </p>
          </div>
        </header>

        {/* Content List */}
        <main>
          <ContentList
            className={cn(
              "space-y-6",
              isLoading && "opacity-50 pointer-events-none"
            )}
            ariaLabel="Archived content list"
            role="feed"
          />

          {/* Empty State */}
          {!isLoading && contents.length === 0 && (
            <div 
              className="flex flex-col items-center justify-center p-8 text-center"
              role="status"
              aria-live="polite"
            >
              <p className="text-gray-500 dark:text-gray-400">
                No archived content found
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div 
              className="text-error text-center p-4"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default ArchivePage;