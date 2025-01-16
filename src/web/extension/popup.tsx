import React, { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner'; // ^1.0.0
import CaptureButton from './components/CaptureButton';
import CaptureList from './components/CaptureList';
import SyncStatus from './components/SyncStatus';
import { Content, ContentStatus } from '../src/types/content';
import { setupAutoSync, syncContent } from './utils/sync';
import { getFromExtensionStorage } from './utils/storage';
import { colors, typography } from '../src/constants/theme';

// Constants for popup dimensions and behavior
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 600;
const LIST_HEIGHT = 400;
const STORAGE_WARNING_THRESHOLD = 80;

/**
 * Enhanced popup component for the Chrome extension
 * Implements capture functionality, content list, and sync status
 */
const Popup: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize sync and storage monitoring
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Setup automatic content synchronization
        setupAutoSync();
        
        // Trigger initial sync
        await syncContent(true);
        
        setIsInitialized(true);
      } catch (error) {
        setError(error instanceof Error ? error : new Error('Failed to initialize popup'));
      }
    };

    initializePopup();

    // Cleanup on unmount
    return () => {
      // Any cleanup needed for sync/storage monitoring
    };
  }, []);

  // Handle content capture completion
  const handleCaptureComplete = useCallback(async (content: Content) => {
    try {
      setIsLoading(true);

      // Trigger sync after capture
      await syncContent(true);

      // Show success notification
      Toaster.success({
        title: 'Content Captured',
        description: 'Content has been saved and will be synced with membo.ai'
      });

    } catch (error) {
      // Show error notification
      Toaster.error({
        title: 'Capture Failed',
        description: error instanceof Error ? error.message : 'Failed to capture content'
      });
      
      setError(error instanceof Error ? error : new Error('Capture failed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle storage quota warnings
  const handleStorageWarning = useCallback((quota: { totalItems: number; quotaUsage: number }) => {
    if (quota.quotaUsage > STORAGE_WARNING_THRESHOLD) {
      Toaster.warning({
        title: 'Storage Warning',
        description: `Storage usage is at ${Math.round(quota.quotaUsage)}%. Please sync or clear old content.`
      });
    }
  }, []);

  // Handle general errors
  const handleError = useCallback((error: Error) => {
    setError(error);
    Toaster.error({
      title: 'Error',
      description: error.message
    });
  }, []);

  return (
    <div 
      className="flex flex-col h-screen bg-white dark:bg-gray-900"
      style={{ width: POPUP_WIDTH, height: POPUP_HEIGHT }}
      role="dialog"
      aria-label="membo.ai Content Capture"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <img 
            src="icon-48.png" 
            alt="membo.ai" 
            className="w-8 h-8"
          />
          <h1 className={`text-${typography.fontSize.xl} font-${typography.fontWeight.semibold} text-${colors.primary}`}>
            membo.ai
          </h1>
        </div>
        
        <CaptureButton
          onCaptureComplete={handleCaptureComplete}
          onCaptureError={handleError}
          isLoading={isLoading}
          className="ml-auto"
        />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {error ? (
          <div 
            className="p-4 text-red-600 bg-red-50 dark:bg-red-900/20"
            role="alert"
          >
            <p className="font-medium">Error:</p>
            <p>{error.message}</p>
          </div>
        ) : !isInitialized ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <CaptureList
            virtualListConfig={{
              height: LIST_HEIGHT,
              itemSize: 100,
              overscanCount: 5
            }}
            onStorageWarning={handleStorageWarning}
            onError={handleError}
            className="flex-1"
          />
        )}
      </main>

      {/* Footer with sync status */}
      <footer className="border-t border-gray-200 dark:border-gray-700">
        <SyncStatus className="p-4" />
      </footer>

      {/* Toast notifications */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          className: 'dark:bg-gray-800 dark:text-white'
        }}
      />
    </div>
  );
};

export default Popup;