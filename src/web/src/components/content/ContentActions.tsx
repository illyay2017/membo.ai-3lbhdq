/**
 * Component that renders action buttons for content items with role-based access control
 * Implements processing, archival, and deletion operations with loading states and confirmations
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAnalytics } from '@mixpanel/browser';
import Button from '../ui/button';
import { useContentStore } from '../../store/contentStore';
import { useAuth } from '../../hooks/useAuth';
import { ContentStatus } from '../../types/content';
import { UserRole } from '@shared/types/userRoles';

interface ContentActionsProps {
  contentId: string;
  status: ContentStatus;
  isOwner: boolean;
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000,
};

const ContentActions: React.FC<ContentActionsProps> = ({
  contentId,
  status,
  isOwner,
}) => {
  // State for loading indicators
  const [isProcessing, setIsProcessing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hooks for content management and auth
  const { processContent, archiveContent, deleteContent } = useContentStore();
  const { user } = useAuth();
  const analytics = useAnalytics();

  /**
   * Handles content processing with retry mechanism
   */
  const handleProcess = useCallback(async () => {
    if (!user || !isOwner) return;

    setIsProcessing(true);
    let attempts = 0;

    try {
      analytics.track('Content Process Started', { contentId });

      while (attempts < RETRY_CONFIG.maxAttempts) {
        try {
          const processedContent = await processContent(contentId);
          
          toast.success('Content processed successfully', {
            description: 'Cards have been generated from your content',
            action: {
              label: 'View Cards',
              onClick: () => window.location.href = `/cards?content=${contentId}`,
            },
          });

          analytics.track('Content Process Completed', {
            contentId,
            attempts: attempts + 1,
          });

          return processedContent;
        } catch (error) {
          attempts++;
          if (attempts === RETRY_CONFIG.maxAttempts) throw error;
          
          const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(2, attempts),
            RETRY_CONFIG.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      toast.error('Failed to process content', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });

      analytics.track('Content Process Failed', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [contentId, user, isOwner, processContent, analytics]);

  /**
   * Handles content archival with offline support
   */
  const handleArchive = useCallback(async () => {
    if (!user || !isOwner) return;

    setIsArchiving(true);

    try {
      analytics.track('Content Archive Started', { contentId });

      const archivedContent = await archiveContent(contentId);

      toast.success('Content archived', {
        description: 'Content has been moved to archives',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await processContent(contentId);
              toast.success('Content restored');
            } catch (error) {
              toast.error('Failed to restore content');
            }
          },
        },
      });

      analytics.track('Content Archive Completed', { contentId });

      return archivedContent;
    } catch (error) {
      toast.error('Failed to archive content', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });

      analytics.track('Content Archive Failed', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsArchiving(false);
    }
  }, [contentId, user, isOwner, archiveContent, processContent, analytics]);

  /**
   * Handles content deletion with confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!user || !isOwner) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this content? This action cannot be undone.'
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      analytics.track('Content Delete Started', { contentId });

      await deleteContent(contentId);

      toast.success('Content deleted', {
        description: 'Content has been permanently removed',
      });

      analytics.track('Content Delete Completed', { contentId });
    } catch (error) {
      toast.error('Failed to delete content', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });

      analytics.track('Content Delete Failed', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [contentId, user, isOwner, deleteContent, analytics]);

  // Only show actions if user is owner or has sufficient permissions
  if (!user || (!isOwner && user.role !== UserRole.SYSTEM_ADMIN)) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      {status === ContentStatus.NEW && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleProcess}
          loading={isProcessing}
          disabled={isProcessing || isArchiving || isDeleting}
        >
          Process
        </Button>
      )}

      {status === ContentStatus.PROCESSED && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleArchive}
          loading={isArchiving}
          disabled={isProcessing || isArchiving || isDeleting}
        >
          Archive
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        loading={isDeleting}
        disabled={isProcessing || isArchiving || isDeleting}
      >
        Delete
      </Button>
    </div>
  );
};

export default ContentActions;