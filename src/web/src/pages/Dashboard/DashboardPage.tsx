import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { ErrorBoundary } from 'react-error-boundary';
import { api } from '../../lib/api';

import StudyStats from '../../components/study/StudyStats';
import ContentList from '../../components/content/ContentList';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStudySession } from '../../hooks/useStudySession';

interface DashboardPageProps {
  className?: string;
  offlineMode?: boolean;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  className,
  offlineMode = false
}) => {
  const [recentContent, setRecentContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize study session with offline support
  const {
    performance,
    voiceMode,
    syncStatus,
    offlineMode: isOffline,
    forceSync
  } = useStudySession();

  // Initialize WebSocket for real-time updates
  const { connect, subscribe, disconnect } = useWebSocket(
    localStorage.getItem('authToken') || '',
    { autoReconnect: true }
  );

  // Fetch recent content
  useEffect(() => {
    const fetchRecentContent = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/content/recent');
        setRecentContent(response.data);
      } catch (err) {
        setError('Failed to load recent content');
        console.error('Error fetching recent content:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentContent();
  }, []);

  // Handle real-time performance updates
  const handlePerformanceUpdate = useCallback((data: any) => {
    if (!isOffline) {
      forceSync();
    }
  }, [isOffline, forceSync]);

  // Setup WebSocket connection and subscriptions
  useEffect(() => {
    connect();
    subscribe('performance_update', handlePerformanceUpdate);
    return () => {
      disconnect();
    };
  }, [connect, disconnect, subscribe, handlePerformanceUpdate]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="flex items-center justify-center p-6 bg-error/10 rounded-lg">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-error mb-2">
          Dashboard Error
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {error?.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
        >
          Retry
        </button>
      </div>
    </div>
  );

  // Memoized container classes
  const containerClasses = useMemo(() => cn(
    'grid gap-6 p-6',
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    className
  ), [className]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className={cn('space-y-6', className)}>
        {/* Recent Content Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Recent Content</h2>
          <ContentList 
            items={recentContent}
            loading={isLoading}
            error={error}
          />
        </section>

        {/* Performance Overview Section */}
        <section>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Performance Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {performance.retentionRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500">Retention Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">
                  {performance.studyStreak}
                </p>
                <p className="text-sm text-gray-500">Day Streak</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">
                  {performance.totalCards}
                </p>
                <p className="text-sm text-gray-500">Cards Studied</p>
              </div>
            </div>
          </div>
        </section>

        {/* Study Stats Section */}
        <StudyStats className="mt-6" />
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;
