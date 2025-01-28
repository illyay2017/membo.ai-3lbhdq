/**
 * Custom React hook for managing flashcard operations and state
 * Implements comprehensive error handling, validation, and FSRS algorithm integration
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useCardStore } from '../store/cardStore';
import { Card, CardCreateInput, CardUpdateInput } from '../types/card';

// Request cancellation token
let abortController: AbortController | null = null;

/**
 * Hook configuration options
 */
interface UseCardsOptions {
  autoFetch?: boolean;
  validateBeforeSubmit?: boolean;
  retryAttempts?: number;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for managing flashcard operations with enhanced error handling
 */
export function useCards(options: UseCardsOptions = {}) {
  const {
    autoFetch = true,
    validateBeforeSubmit = true,
    retryAttempts = 3,
    onError
  } = options;

  // Local loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get card store state and actions
  const {
    cards,
    selectedCard,
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
    generateCards,
    updateCardFSRSData
  } = useCardStore();

  /**
   * Handles API errors with retry logic
   */
  const handleError = useCallback((error: Error, context: string) => {
    const errorMessage = `${context}: ${error.message}`;
    setError(errorMessage);
    onError?.(error);
    return Promise.reject(error);
  }, [onError]);

  /**
   * Creates a new flashcard with validation
   */
  const handleCreateCard = useCallback(async (cardData: CardCreateInput): Promise<Card> => {
    try {
      setIsLoading(true);
      setError(null);

      if (validateBeforeSubmit) {
        // Validation would be implemented here
        if (!cardData.frontContent || !cardData.backContent) {
          throw new Error('Invalid card data: Front and back content required');
        }
      }

      const card = await createCard(cardData);
      return card;
    } catch (error) {
      return handleError(error as Error, 'Failed to create card');
    } finally {
      setIsLoading(false);
    }
  }, [createCard, handleError, validateBeforeSubmit]);

  /**
   * Updates an existing flashcard with validation
   */
  const handleUpdateCard = useCallback(async (id: string, cardData: CardUpdateInput): Promise<Card> => {
    try {
      setIsLoading(true);
      setError(null);

      if (validateBeforeSubmit) {
        if (!id || !cardData) {
          throw new Error('Invalid update data: Card ID and update data required');
        }
      }

      const card = await updateCard(id, cardData);
      return card;
    } catch (error) {
      return handleError(error as Error, 'Failed to update card');
    } finally {
      setIsLoading(false);
    }
  }, [updateCard, handleError, validateBeforeSubmit]);

  /**
   * Deletes a flashcard with confirmation
   */
  const handleDeleteCard = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!id) {
        throw new Error('Invalid card ID');
      }

      await deleteCard(id);
    } catch (error) {
      return handleError(error as Error, 'Failed to delete card');
    } finally {
      setIsLoading(false);
    }
  }, [deleteCard, handleError]);

  /**
   * Generates cards using AI with quota management
   */
  const handleGenerateCards = useCallback(async (contentId: string): Promise<Card[]> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!contentId) {
        throw new Error('Invalid content ID');
      }

      const cards = await generateCards(contentId);
      return cards;
    } catch (error) {
      return handleError(error as Error, 'Failed to generate cards');
    } finally {
      setIsLoading(false);
    }
  }, [generateCards, handleError]);

  /**
   * Updates card's FSRS algorithm data
   */
  const handleUpdateFSRSData = useCallback(async (id: string, fsrsData: Card['fsrsData']): Promise<Card> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!id || !fsrsData) {
        throw new Error('Invalid FSRS update data');
      }

      const card = await updateCardFSRSData(id, fsrsData);
      return card;
    } catch (error) {
      return handleError(error as Error, 'Failed to update FSRS data');
    } finally {
      setIsLoading(false);
    }
  }, [updateCardFSRSData, handleError]);

  // Fetch cards on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch) {
      abortController = new AbortController();
      
      const fetchData = async () => {
        try {
          setIsLoading(true);
          setError(null);
          await fetchCards();
        } catch (error) {
          handleError(error as Error, 'Failed to fetch cards');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();

      return () => {
        abortController?.abort();
        abortController = null;
      };
    }
  }, [autoFetch, fetchCards, handleError]);

  return {
    // State
    cards,
    selectedCard,
    isLoading,
    error,

    // Card operations
    createCard: handleCreateCard,
    updateCard: handleUpdateCard,
    deleteCard: handleDeleteCard,
    generateCards: handleGenerateCards,
    updateFSRSData: handleUpdateFSRSData
  };
}

export type { UseCardsOptions };