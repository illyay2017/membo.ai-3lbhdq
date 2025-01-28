import * as React from 'react';
import { cn } from '@/lib/utils';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { colors } from '@/constants/theme';
import { Card } from '../ui/card';

// Types for content status and metadata
type ContentStatus = 'pending' | 'processing' | 'processed' | 'error';

interface Content {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  status: ContentStatus;
  createdAt: string;
  metadata: {
    type: 'web' | 'pdf' | 'kindle';
    wordCount: number;
    language?: string;
  };
}

interface ContentCardProps {
  content: Content;
  onUpdate: (content: Content) => void;
  className?: string;
  showActions?: boolean;
  isLoading?: boolean;
}

// Utility function to get status color from theme
const getStatusColor = (status: ContentStatus): string => {
  switch (status) {
    case 'pending':
      return colors.semantic.warning;
    case 'processing':
      return colors.semantic.info;
    case 'processed':
      return colors.semantic.success;
    case 'error':
      return colors.error;
    default:
      return colors.secondary;
  }
};

// Hook for tracking card interactions
const useCardAnalytics = (content: Content) => {
  const trackView = React.useCallback(() => {
    // Implementation would track card view events
  }, [content.id]);

  const trackAction = React.useCallback((action: string) => {
    // Implementation would track action interactions
  }, [content.id]);

  React.useEffect(() => {
    trackView();
  }, [trackView]);

  return { trackAction };
};

export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  onUpdate,
  className,
  showActions = true,
  isLoading = false
}) => {
  const { hasAccess } = useRoleAccess();
  const { trackAction } = useCardAnalytics(content);

  // Base card classes
  const cardClasses = cn(
    'rounded-lg border border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-900',
    'hover:shadow-md transition-shadow duration-200',
    {
      'animate-pulse bg-gray-50 dark:bg-gray-800': isLoading,
      [`border-l-4 border-l-[${getStatusColor(content.status)}]`]: !isLoading
    },
    className
  );

  const handleProcessContent = React.useCallback(() => {
    if (!hasAccess('content:process')) return;
    trackAction('process');
    onUpdate({ ...content, status: 'processing' });
  }, [content, onUpdate, hasAccess, trackAction]);

  const handleArchiveContent = React.useCallback(() => {
    if (!hasAccess('content:archive')) return;
    trackAction('archive');
    // Implementation would handle content archival
  }, [content.id, hasAccess, trackAction]);

  return (
    <Card.Root className={cardClasses}>
      <Card.Header className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {content.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(content.createdAt).toLocaleDateString()} • 
            {content.metadata.type.toUpperCase()} • 
            {content.metadata.wordCount} words
          </p>
        </div>
      </Card.Header>

      <Card.Content className="p-4">
        <p className="text-gray-700 dark:text-gray-300 line-clamp-3 sm:line-clamp-2">
          {content.content}
        </p>
        {content.source && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2">
            <span>Source:</span>
            {content.sourceUrl ? (
              <a 
                href={content.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                {content.source}
              </a>
            ) : (
              <span>{content.source}</span>
            )}
          </div>
        )}
      </Card.Content>

      <Card.Footer className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800">
        <span className="text-sm font-medium" style={{ color: getStatusColor(content.status) }}>
          {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
        </span>

        {showActions && !isLoading && (
          <div className="flex gap-2">
            {content.status === 'pending' && hasAccess('content:process') && (
              <button
                onClick={handleProcessContent}
                className="px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                Process
              </button>
            )}
            {hasAccess('content:archive') && (
              <button
                onClick={handleArchiveContent}
                className="px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Archive
              </button>
            )}
          </div>
        )}
      </Card.Footer>
    </Card.Root>
  );
};

export default ContentCard;