import React from 'react';
import cn from 'classnames';
import { getSyncStatus, syncContent, type SyncStatus as ISyncStatus } from '../utils/sync';
import Toast from '../../src/components/ui/toast';

// Constants for sync status management
const SYNC_STATUS_POLL_INTERVAL = 5000;
const SYNC_ERROR_DISPLAY_DURATION = 3000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_BASE = 2000;
const SYNC_TIMEOUT = 30000;
const OFFLINE_POLL_INTERVAL = 10000;

interface ISyncStatusProps {
  className?: string;
}

interface ISyncState {
  lastSyncTime: Date;
  pendingItems: number;
  isOnline: boolean;
  retryCount: number;
  syncProgress: number;
  error: string | null;
}

const SyncStatus: React.FC<ISyncStatusProps> = ({ className }) => {
  const [state, setState] = React.useState<ISyncState>({
    lastSyncTime: new Date(),
    pendingItems: 0,
    isOnline: navigator.onLine,
    retryCount: 0,
    syncProgress: 0,
    error: null
  });

  const pollIntervalRef = React.useRef<NodeJS.Timeout>();
  const syncTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Initialize sync status polling
  React.useEffect(() => {
    const pollStatus = async () => {
      try {
        const status = await getSyncStatus();
        setState(prev => ({
          ...prev,
          lastSyncTime: status.lastSyncTime,
          pendingItems: status.pendingItems,
          error: status.syncError || null
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to get sync status'
        }));
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval
    pollIntervalRef.current = setInterval(
      pollStatus,
      state.isOnline ? SYNC_STATUS_POLL_INTERVAL : OFFLINE_POLL_INTERVAL
    );

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [state.isOnline]);

  // Handle online/offline status
  React.useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      handleManualSync(); // Attempt sync when coming back online
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle manual sync with retry logic
  const handleManualSync = async () => {
    if (!state.isOnline) {
      Toast.error({ message: 'No internet connection available' });
      return;
    }

    setState(prev => ({ ...prev, syncProgress: 0 }));

    try {
      // Set sync timeout
      syncTimeoutRef.current = setTimeout(() => {
        throw new Error('Sync operation timed out');
      }, SYNC_TIMEOUT);

      // Attempt sync with progress updates
      await syncContent(true);
      
      // Clear timeout on success
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      setState(prev => ({
        ...prev,
        syncProgress: 100,
        retryCount: 0,
        error: null
      }));

      Toast.success({ message: 'Content synchronized successfully' });

    } catch (error) {
      // Clear timeout on error
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // Handle retry logic
      if (state.retryCount < MAX_RETRY_ATTEMPTS) {
        const nextRetryDelay = RETRY_BACKOFF_BASE * Math.pow(2, state.retryCount);
        setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
        
        Toast.info({ 
          message: `Retrying sync in ${nextRetryDelay / 1000} seconds...`,
          duration: nextRetryDelay
        });

        setTimeout(handleManualSync, nextRetryDelay);
        return;
      }

      // Max retries exceeded
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncProgress: 0
      }));

      Toast.error({ 
        message: 'Sync failed after multiple attempts',
        duration: SYNC_ERROR_DISPLAY_DURATION
      });
    }
  };

  // Format relative time for last sync
  const getRelativeTime = (date: Date): string => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffInMinutes = Math.round((date.getTime() - new Date().getTime()) / (1000 * 60));
    
    if (Math.abs(diffInMinutes) < 60) {
      return rtf.format(diffInMinutes, 'minute');
    }
    return rtf.format(Math.round(diffInMinutes / 60), 'hour');
  };

  return (
    <div 
      className={cn(
        'flex flex-col space-y-2 p-4 rounded-lg border',
        {
          'bg-red-50 border-red-200': state.error,
          'bg-green-50 border-green-200': !state.error && state.pendingItems === 0,
          'bg-yellow-50 border-yellow-200': !state.error && state.pendingItems > 0
        },
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {state.isOnline ? 'Online' : 'Offline'}
        </span>
        <button
          onClick={handleManualSync}
          disabled={!state.isOnline || state.syncProgress > 0}
          className={cn(
            'px-3 py-1 rounded text-sm font-medium',
            'transition-colors duration-200',
            {
              'bg-blue-500 text-white hover:bg-blue-600': state.isOnline,
              'bg-gray-300 text-gray-500 cursor-not-allowed': !state.isOnline
            }
          )}
          aria-label="Synchronize content"
        >
          Sync Now
        </button>
      </div>

      {state.syncProgress > 0 && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${state.syncProgress}%` }}
            role="progressbar"
            aria-valuenow={state.syncProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      <div className="text-sm space-y-1">
        <p>
          Last synced: {getRelativeTime(state.lastSyncTime)}
        </p>
        {state.pendingItems > 0 && (
          <p className="text-yellow-700">
            {state.pendingItems} item{state.pendingItems !== 1 ? 's' : ''} pending sync
          </p>
        )}
        {state.error && (
          <p className="text-red-600" role="alert">
            Error: {state.error}
          </p>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;