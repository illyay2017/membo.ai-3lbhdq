import React, { useCallback, useEffect, useState } from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import { ErrorBoundary } from 'react-error-boundary';
import classNames from 'classnames';
import { Skeleton } from "../../src/components/ui/skeleton";
import { Content, ContentStatus } from '../../src/types/content';
import { getFromExtensionStorage, clearSyncedContent } from '../utils/storage';
import { getSyncStatus } from '../utils/sync';
import Button from '../../src/components/ui/button';
import { typography, colors } from '../../src/constants/theme';

// Interface for storage quota information
interface StorageQuota {
  totalItems: number;
  quotaUsage: number;
}

// Props interface for the CaptureList component
interface CaptureListProps {
  className?: string;
  onStorageWarning?: (quota: StorageQuota) => void;
  onError?: (error: Error) => void;
  virtualListConfig?: {
    height: number;
    itemSize: number;
    overscanCount?: number;
  };
}

// Custom hook for managing captured content
const useCapturedContent = () => {
  const [content, setContent] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [storageQuota, setStorageQuota] = useState<StorageQuota>({ totalItems: 0, quotaUsage: 0 });

  const fetchContent = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await getFromExtensionStorage();
      const syncStatus = await getSyncStatus();
      
      // Sort items by creation date descending
      const sortedItems = items.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setContent(sortedItems);
      setStorageQuota({
        totalItems: items.length,
        quotaUsage: (items.length / 1000) * 100 // Based on MAX_STORAGE_ITEMS constant
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch content'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.content) {
        fetchContent();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [fetchContent]);

  return { content, isLoading, error, refresh: fetchContent, storageQuota };
};

// Main CaptureList component
const CaptureList: React.FC<CaptureListProps> = ({
  className,
  onStorageWarning,
  onError,
  virtualListConfig = { height: 400, itemSize: 100, overscanCount: 5 }
}) => {
  const { content, isLoading, error, refresh, storageQuota } = useCapturedContent();

  // Notify parent of storage warnings
  useEffect(() => {
    if (storageQuota.quotaUsage > 80 && onStorageWarning) {
      onStorageWarning(storageQuota);
    }
  }, [storageQuota, onStorageWarning]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={classNames('space-y-4 p-4', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    );
  }

  // Render empty state
  if (!content.length) {
    return (
      <div 
        className={classNames('flex flex-col items-center justify-center p-8 text-center', className)}
        role="status"
        aria-label="No captured content"
      >
        <p className={`text-${typography.fontSize.lg} font-${typography.fontWeight.medium} mb-4`}>
          No captured content yet
        </p>
        <p className={`text-${typography.fontSize.base} text-${colors.secondary} mb-6`}>
          Highlight text on any webpage and click the membo.ai extension icon to capture
        </p>
        <Button variant="outline" onClick={() => window.open('https://membo.ai/guide', '_blank')}>
          View Capture Guide
        </Button>
      </div>
    );
  }

  // Render individual content item
  const renderContentItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = content[index];
    const syncStatus = item.status === ContentStatus.PROCESSED ? 'Synced' : 'Pending';

    return (
      <div
        key={item.id}
        style={style}
        className="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
        role="listitem"
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className={`text-${typography.fontSize.base} font-${typography.fontWeight.medium} truncate flex-1`}>
            {item.metadata.title || 'Untitled Capture'}
          </h3>
          <span 
            className={classNames('text-sm px-2 py-1 rounded-full', {
              'bg-green-100 text-green-800': syncStatus === 'Synced',
              'bg-yellow-100 text-yellow-800': syncStatus === 'Pending'
            })}
          >
            {syncStatus}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2 line-clamp-2" title={item.content}>
          {item.content}
        </p>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>{new Date(item.createdAt).toLocaleString()}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearSyncedContent([item.id])}
            aria-label="Remove captured content"
          >
            Remove
          </Button>
        </div>
      </div>
    );
  };

  // Render main content list
  return (
    <ErrorBoundary
      fallback={<div className="p-4 text-red-500">Error displaying content list</div>}
      onError={onError}
    >
      <div className={classNames('relative', className)} role="list">
        <VirtualList
          height={virtualListConfig.height}
          itemCount={content.length}
          itemSize={virtualListConfig.itemSize}
          overscanCount={virtualListConfig.overscanCount}
          width="100%"
        >
          {renderContentItem}
        </VirtualList>
      </div>
    </ErrorBoundary>
  );
};

export default CaptureList;