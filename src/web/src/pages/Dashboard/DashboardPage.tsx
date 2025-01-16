import React, { useEffect, useCallback, useMemo } from 'react';
import { cn } from 'classnames';
import { ErrorBoundary } from 'react-error-boundary';

import AppShell from '../../components/layout/AppShell';
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
          {error.message}
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
      <AppShell>
        <main className={containerClasses}>
          {/* Study Statistics Section */}
          <section className="col-span-full lg:col-span-2">
            <StudyStats
              className="h-full"
              variant="detailed"
              showVoiceMetrics={voiceMode.enabled}
              offlineMode={isOffline}
            />
            
            {/* Offline Indicator */}
            {isOffline && (
              <div className="mt-4 p-4 bg-warning/10 rounded-lg" role="alert">
                <p className="text-sm text-warning flex items-center gap-2">
                  ⚠️ Offline Mode - Changes will sync when connection is restored
                  {syncStatus.pendingSync && (
                    <span className="text-xs">
                      ({syncStatus.pendingSync} updates pending)
                    </span>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* Recent Content Section */}
          <section className="col-span-full lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold mb-4">Recent Content</h2>
              <ContentList
                className="h-[600px]"
                virtualScroll
                ariaLabel="Recent content items"
              />
            </div>
          </section>

          {/* Performance Metrics Section */}
          <section className="col-span-full">
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
        </main>
      </AppShell>
    </ErrorBoundary>
  );
};

export default DashboardPage;