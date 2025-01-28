import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { cn } from '@/lib/utils'; // Use local cn utility
import CardPreview from './CardPreview';
import { Card } from '../../types/card';
import { useCards } from '../../hooks/useCards';

interface CardListProps {
  cards: Card[];
  onCardSelect?: (card: Card) => void;
  layout?: 'grid' | 'list';
  className?: string;
  sortBy?: 'lastReviewed' | 'created' | 'difficulty';
  filterTags?: string[];
  searchTerm?: string;
  enableVirtualization?: boolean;
}

/**
 * A virtualized, accessible component for displaying flashcard previews in grid or list layout.
 * Implements comprehensive filtering, sorting, and keyboard navigation capabilities.
 */
const CardList = React.memo(({
  cards,
  onCardSelect,
  layout = 'grid',
  className,
  sortBy = 'created',
  filterTags = [],
  searchTerm = '',
  enableVirtualization = true
}: CardListProps) => {
  // Container ref for virtualization
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track selected card for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  
  // Get cards hook for operations
  const { isLoading, error } = useCards();

  // Calculate container dimensions for virtualization
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0
  });

  // Update container dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Filter and sort cards
  const processedCards = React.useMemo(() => {
    let result = [...cards];

    // Apply tag filtering
    if (filterTags.length > 0) {
      result = result.filter(card => 
        filterTags.every(tag => card.tags.includes(tag))
      );
    }

    // Apply search filtering
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(card =>
        card.frontContent.text.toLowerCase().includes(searchLower) ||
        card.backContent.text.toLowerCase().includes(searchLower) ||
        card.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'lastReviewed':
          return b.fsrsData.lastReview.getTime() - a.fsrsData.lastReview.getTime();
        case 'difficulty':
          return b.fsrsData.difficulty - a.fsrsData.difficulty;
        case 'created':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    return result;
  }, [cards, filterTags, searchTerm, sortBy]);

  // Configure virtualizer
  const rowVirtualizer = useVirtualizer({
    count: processedCards.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => layout === 'grid' ? 200 : 120,
    overscan: 5,
    horizontal: false
  });

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        setSelectedIndex(prev => Math.min(prev + 1, processedCards.length - 1));
        break;
      case 'ArrowLeft':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'ArrowUp':
        setSelectedIndex(prev => Math.max(prev - (layout === 'grid' ? 3 : 1), 0));
        break;
      case 'ArrowDown':
        setSelectedIndex(prev => Math.min(prev + (layout === 'grid' ? 3 : 1), processedCards.length - 1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && onCardSelect) {
          onCardSelect(processedCards[selectedIndex]);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }, [layout, processedCards.length, onCardSelect, selectedIndex]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className={styles.error}>
      <p>Error loading cards: {error.message}</p>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return <ErrorFallback error={new Error(error)} />;
  }

  // Empty state
  if (processedCards.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No cards found</p>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        ref={containerRef}
        className={cn(
          styles.container.base,
          layout === 'grid' ? styles.container.grid : styles.container.list,
          className
        )}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Flashcard list"
        tabIndex={0}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const card = processedCards[virtualRow.index];
            return (
              <div
                key={card.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <CardPreview
                  card={card}
                  onClick={() => onCardSelect?.(card)}
                  className={cn(
                    styles.card.base,
                    selectedIndex === virtualRow.index && styles.card.selected,
                    onCardSelect && styles.card.interactive
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    </ErrorBoundary>
  );
});

// Styles object
const styles = {
  container: {
    base: 'w-full relative',
    grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4',
    list: 'flex flex-col space-y-4 p-4'
  },
  loading: 'flex justify-center items-center min-h-[200px] bg-gray-50 dark:bg-gray-800',
  error: 'text-red-500 text-center py-4 bg-red-50 dark:bg-red-900/20 rounded-md',
  empty: 'text-gray-500 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-md',
  card: {
    base: 'focus-visible:ring-2 focus-visible:ring-primary',
    selected: 'ring-2 ring-primary',
    interactive: 'cursor-pointer hover:shadow-md transition-shadow'
  }
} as const;

// Display name for debugging
CardList.displayName = 'CardList';

export default CardList;