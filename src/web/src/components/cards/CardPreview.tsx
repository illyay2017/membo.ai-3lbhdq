import React from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { cn } from 'class-variance-authority'; // v0.7.0
import { Card as CardComponent } from '../ui/card';
import type { Card } from '../../types/card';

interface CardPreviewProps {
  card: Card;
  onClick?: () => void;
  className?: string;
  isLoading?: boolean;
}

/**
 * A preview component for displaying flashcard content in a compact format.
 * Implements design system specifications with theme support and accessibility features.
 */
export const CardPreview = React.memo(({ 
  card, 
  onClick, 
  className,
  isLoading = false 
}: CardPreviewProps) => {
  // Error fallback component for error boundary
  const ErrorFallback = () => (
    <CardComponent.Root 
      variant="default" 
      className={cn(
        'border-error bg-error-50 dark:bg-error-900 p-4',
        className
      )}
    >
      <p className="text-sm text-error">Failed to load card preview</p>
    </CardComponent.Root>
  );

  // Loading skeleton component
  if (isLoading) {
    return (
      <CardComponent.Root
        variant="default"
        className={cn(
          'w-full max-w-sm',
          'animate-pulse',
          className
        )}
      >
        <CardComponent.Header>
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        </CardComponent.Header>
        <CardComponent.Content>
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mt-2" />
          <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
        </CardComponent.Content>
        <CardComponent.Footer>
          <div className="h-2 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
        </CardComponent.Footer>
      </CardComponent.Root>
    );
  }

  // Main card preview component
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <CardComponent.Root
        variant={onClick ? 'interactive' : 'default'}
        className={cn(
          'w-full max-w-sm',
          'hover:shadow-md transition-shadow duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          className
        )}
        onClick={onClick}
        onKeyPress={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <CardComponent.Header>
          <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
            {card.frontContent.text}
          </div>
        </CardComponent.Header>

        <CardComponent.Content>
          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-2">
            {card.backContent.text}
          </div>
        </CardComponent.Content>

        <CardComponent.Footer className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4">
          <div className="flex gap-1 flex-wrap">
            {card.tags.map((tag, index) => (
              <span 
                key={`${card.id}-tag-${index}`}
                className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
          {card.aiGenerated && (
            <span className="text-accent">AI Generated</span>
          )}
        </CardComponent.Footer>
      </CardComponent.Root>
    </ErrorBoundary>
  );
});

// Display name for dev tools and debugging
CardPreview.displayName = 'CardPreview';

export default CardPreview;