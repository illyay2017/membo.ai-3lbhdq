/**
 * Global state management store for flashcard data and study sessions
 * Implements FSRS algorithm integration and tiered study features
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Card } from '../types/card';
import { STUDY_MODES } from '../constants/study';
import { cardService } from '../services/cardService';
import { useUIStore } from './uiStore';
import { UserRole } from "@shared/types/userRoles";

// Study session interface
interface StudySession {
  id: string;
  mode: STUDY_MODES;
  startTime: Date;
  cardsStudied: number;
  correctAnswers: number;
}

// Store state interface
interface CardState {
  cards: Card[];
  dueCards: Card[];
  currentCard: Card | null;
  studySession: StudySession | null;
  userRole: UserRole;
  loading: boolean;
  error: string | null;
}

// Store actions interface
interface CardActions {
  // Card Management
  fetchCards: () => Promise<void>;
  createCard: (card: Partial<Card>) => Promise<void>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  
  // Study Session Management
  initializeStudySession: (mode: STUDY_MODES) => Promise<void>;
  endStudySession: () => Promise<void>;
  recordStudyResult: (cardId: string, rating: number) => Promise<void>;
  fetchDueCards: () => Promise<void>;
  setCurrentCard: (card: Card | null) => void;
  
  // State Management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUserRole: (role: UserRole) => void;
  reset: () => void;
}

// Initial state
const initialState: CardState = {
  cards: [],
  dueCards: [],
  currentCard: null,
  studySession: null,
  userRole: UserRole.FREE_USER,
  loading: false,
  error: null,
};

// Create store with middleware
export const useCardStore = create<CardState & CardActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Card Management Actions
        fetchCards: async () => {
          try {
            set({ loading: true, error: null });
            const response = await cardService.getCards({});
            set({ cards: response.cards });
          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to fetch cards'
            });
          } finally {
            set({ loading: false });
          }
        },

        createCard: async (card) => {
          try {
            set({ loading: true, error: null });
            const newCard = await cardService.createCard(card);
            set(state => ({ cards: [...state.cards, newCard] }));
            useUIStore.getState().showToast({
              type: 'success',
              message: 'Card created successfully'
            });
          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to create card'
            });
          } finally {
            set({ loading: false });
          }
        },

        updateCard: async (id, updates) => {
          try {
            set({ loading: true, error: null });
            const updatedCard = await cardService.updateCard(id, updates);
            set(state => ({
              cards: state.cards.map(card => 
                card.id === id ? updatedCard : card
              )
            }));
          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to update card'
            });
          } finally {
            set({ loading: false });
          }
        },

        deleteCard: async (id) => {
          try {
            set({ loading: true, error: null });
            await cardService.deleteCard(id);
            set(state => ({
              cards: state.cards.filter(card => card.id !== id)
            }));
            useUIStore.getState().showToast({
              type: 'success',
              message: 'Card deleted successfully'
            });
          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to delete card'
            });
          } finally {
            set({ loading: false });
          }
        },

        // Study Session Management Actions
        initializeStudySession: async (mode) => {
          try {
            set({ loading: true, error: null });
            
            // Validate user access to study mode
            const { userRole } = get();
            if (mode !== STUDY_MODES.STANDARD && userRole === UserRole.FREE_USER) {
              throw new Error('This study mode requires a premium subscription');
            }

            // Create new study session
            const sessionId = crypto.randomUUID();
            const session: StudySession = {
              id: sessionId,
              mode,
              startTime: new Date(),
              cardsStudied: 0,
              correctAnswers: 0
            };

            // Fetch initial due cards
            const dueCards = await cardService.getNextDueCards({
              limit: 10,
              studyMode: mode
            });

            set({
              studySession: session,
              dueCards,
              currentCard: dueCards[0] || null
            });

          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to start study session'
            });
          } finally {
            set({ loading: false });
          }
        },

        endStudySession: async () => {
          const { studySession } = get();
          if (!studySession) return;

          try {
            set({ loading: true, error: null });
            
            // Calculate session metrics
            const duration = new Date().getTime() - studySession.startTime.getTime();
            const accuracy = studySession.correctAnswers / studySession.cardsStudied;

            // Clear session state
            set({
              studySession: null,
              currentCard: null,
              dueCards: []
            });

            useUIStore.getState().showToast({
              type: 'success',
              message: `Study session completed! Accuracy: ${Math.round(accuracy * 100)}%`
            });

          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        recordStudyResult: async (cardId, rating) => {
          const { studySession, currentCard, dueCards } = get();
          if (!studySession || !currentCard) return;

          try {
            set({ loading: true, error: null });

            // Record study result
            const updatedCard = await cardService.recordStudyResult(cardId, {
              rating,
              studyMode: studySession.mode,
              responseTime: new Date().getTime() - studySession.startTime.getTime()
            });

            // Update session metrics
            const isCorrect = rating >= 3; // GOOD or EASY rating
            set(state => ({
              studySession: state.studySession ? {
                ...state.studySession,
                cardsStudied: state.studySession.cardsStudied + 1,
                correctAnswers: state.studySession.correctAnswers + (isCorrect ? 1 : 0)
              } : null
            }));

            // Update cards state
            set(state => ({
              cards: state.cards.map(card => 
                card.id === cardId ? updatedCard : card
              ),
              dueCards: state.dueCards.slice(1),
              currentCard: state.dueCards[1] || null
            }));

            // Fetch more due cards if needed
            if (dueCards.length < 3) {
              const newDueCards = await cardService.getNextDueCards({
                limit: 10,
                studyMode: studySession.mode
              });
              set(state => ({
                dueCards: [...state.dueCards, ...newDueCards]
              }));
            }

          } catch (error) {
            set({ error: (error as Error).message });
            useUIStore.getState().showToast({
              type: 'error',
              message: 'Failed to record study result'
            });
          } finally {
            set({ loading: false });
          }
        },

        fetchDueCards: async () => {
          const { studySession } = get();
          if (!studySession) return;

          try {
            set({ loading: true, error: null });
            const dueCards = await cardService.getNextDueCards({
              limit: 10,
              studyMode: studySession.mode
            });
            set({ dueCards });
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        // State Management Actions
        setCurrentCard: (card) => set({ currentCard: card }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        setUserRole: (role) => set({ userRole: role }),
        reset: () => set(initialState),
      }),
      {
        name: 'membo-card-store',
        partialize: (state) => ({
          userRole: state.userRole
        })
      }
    )
  )
);