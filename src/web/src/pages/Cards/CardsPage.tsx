import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { analytics } from '../../lib/analytics';

import CardList from '../../components/cards/CardList';
import CardFilters from '../../components/cards/CardFilters';
import { useCardStore } from '../../store/cardStore';
import { STUDY_MODES } from '../../constants/study';
import type { Card } from '../../types/card';

// Local state interface for the CardsPage component
interface CardsPageState {
  selectedMode: STUDY_MODES | null;
  selectedTags: string[];
  layout: 'grid' | 'list';
  sortBy: string;
  page: number;
  error: Error | null;
}

/**
 * Main page component for managing flashcards in the membo.ai web application.
 * Implements comprehensive card management with filtering, sorting, and role-based access.
 */
const CardsPage: React.FC = () => {
  const navigate = useNavigate();

  // Get card store state and actions
  const { 
    cards, 
    loading, 
    error: storeError,
    fetchCards,
    userRole 
  } = useCardStore();

  // Local state management
  const [state, setState] = useState<CardsPageState>({
    selectedMode: null,
    selectedTags: [],
    layout: 'grid',
    sortBy: 'next-review',
    page: 1,
    error: null
  });

  // Fetch cards on component mount
  useEffect(() => {
    const loadCards = async () => {
      try {
        await fetchCards();
      } catch (error) {
        setState(prev => ({ ...prev, error: error as Error }));
      }
    };
    loadCards();
  }, [fetchCards]);

  // Handle card selection and navigation
  const handleCardSelect = useCallback((card: Card) => {
    analytics.trackCardInteraction({
      type: 'card_selected',
      path: `/cards/${card.id}`,
      timestamp: Date.now()
    });

    navigate(`/cards/${card.id}`);
  }, [navigate]);

  // Handle study mode changes
  const handleModeChange = useCallback((mode: STUDY_MODES | null) => {
    analytics.trackCardInteraction({
      type: 'study_mode_changed',
      path: location.pathname,
      mode,
      userRole,
      timestamp: Date.now()
    });

    setState(prev => ({ ...prev, selectedMode: mode, page: 1 }));
  }, [userRole]);

  // Handle tag filter changes
  const handleTagsChange = useCallback((tags: string[]) => {
    setState(prev => ({ ...prev, selectedTags: tags, page: 1 }));
  }, []);

  // Handle sort option changes
  const handleSortChange = useCallback((sort: string) => {
    setState(prev => ({ ...prev, sortBy: sort, page: 1 }));
  }, []);

  // Handle layout toggle
  const handleLayoutToggle = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      layout: prev.layout === 'grid' ? 'list' : 'grid' 
    }));
  }, []);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-md">
      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
        Error Loading Cards
      </h3>
      <p className="mt-2 text-sm text-red-500 dark:text-red-300">
        {error.message}
      </p>
    </div>
  );

  // Get available tags from cards
  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    cards.forEach(card => card.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [cards]);

  // Filter and sort cards based on selected options
  const filteredCards = React.useMemo(() => {
    let result = [...cards];

    // Apply mode filter
    if (state.selectedMode) {
      result = result.filter(card => 
        card.compatibleModes.includes(state.selectedMode)
      );
    }

    // Apply tag filter
    if (state.selectedTags.length > 0) {
      result = result.filter(card =>
        state.selectedTags.every(tag => card.tags.includes(tag))
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (state.sortBy) {
        case 'next-review':
          return a.nextReview.getTime() - b.nextReview.getTime();
        case 'created-desc':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'created-asc':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'difficulty-desc':
          return b.fsrsData.difficulty - a.fsrsData.difficulty;
        case 'difficulty-asc':
          return a.fsrsData.difficulty - b.fsrsData.difficulty;
        default:
          return 0;
      }
    });

    return result;
  }, [cards, state.selectedMode, state.selectedTags, state.sortBy]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Flashcards
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLayoutToggle}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={`Switch to ${state.layout === 'grid' ? 'list' : 'grid'} view`}
            >
              {state.layout === 'grid' ? 'List View' : 'Grid View'}
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <CardFilters
          selectedMode={state.selectedMode}
          selectedTags={state.selectedTags}
          selectedSort={state.sortBy}
          onModeChange={handleModeChange}
          onTagsChange={handleTagsChange}
          onSortChange={handleSortChange}
          availableTags={availableTags}
          userTier={userRole}
          cardCount={filteredCards.length}
        />

        {/* Cards Grid/List */}
        <div className="mt-6 min-h-[500px] relative">
          <CardList
            cards={filteredCards}
            onCardSelect={handleCardSelect}
            layout={state.layout}
            isLoading={loading}
          />
        </div>

        {/* Error Display */}
        {(state.error || storeError) && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-md">
            <p className="text-red-600 dark:text-red-400">
              {state.error?.message || storeError}
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default CardsPage;
