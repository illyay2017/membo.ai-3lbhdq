import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { api } from '../../lib/api';
import ContentList from '../../components/content/ContentList';

/**
 * InboxPage component displays the user's content inbox with real-time updates,
 * infinite scrolling, and enhanced error handling.
 */
const InboxPage: React.FC = () => {
  const [contents, setContents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContents = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/content/inbox');
        setContents(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to retrieve content items');
        console.error('Error fetching inbox contents:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContents();
  }, []);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="text-center py-8 text-muted-foreground">
      <p>Error: {error.message}</p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
      >
        Retry
      </button>
    </div>
  );

  const emptyState = (
    <div className="text-center py-8 text-muted-foreground">
      <p>No content found in your inbox.</p>
      <p className="mt-2">
        Use the Chrome extension to capture content from the web.
      </p>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Content Inbox</h1>
          <p className="mt-2 text-muted-foreground">
            Process your captured content into flashcards
          </p>
        </div>

        <div className="space-y-4">
          <ContentList
            items={contents}
            loading={isLoading}
            error={error}
            className="rounded-lg border bg-card"
            ariaLabel="Content inbox list"
            role="feed"
            emptyStateComponent={emptyState}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default InboxPage;
