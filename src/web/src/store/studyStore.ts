/**
 * @fileoverview Zustand store for study session management with voice capabilities,
 * FSRS algorithm integration, and offline support.
 * Implements comprehensive performance tracking and real-time synchronization.
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { StudySession, StudyPerformance, StudySessionSettings } from '../types/study';
import { STUDY_MODES } from '../constants/study';
import { StudyService } from '../services/studyService';
import { VoiceService } from '../services/voiceService';
import { Card } from '../types/card';
import { VoiceRecognitionState } from '../types/voice';

// Initialize services
const studyService = new StudyService();
const voiceService = new VoiceService();

/**
 * Interface defining the study store state
 */
interface StudyState {
    currentSession: StudySession | null;
    currentCard: Card | null;
    isLoading: boolean;
    error: string | null;
    studyStreak: number;
    performance: StudyPerformance;
    voiceMode: {
        enabled: boolean;
        state: VoiceRecognitionState;
        error: string | null;
    };
    syncStatus: {
        lastSync: number;
        isOnline: boolean;
        pendingSync: boolean;
    };
    offlineMode: boolean;
}

/**
 * Interface defining study store actions
 */
interface StudyActions {
    startSession: (settings: StudySessionSettings) => Promise<void>;
    endSession: () => Promise<void>;
    submitReview: (confidence: number) => Promise<void>;
    toggleVoiceMode: () => Promise<void>;
    loadNextCard: () => Promise<void>;
    setError: (error: string | null) => void;
    updatePerformance: (metrics: Partial<StudyPerformance>) => void;
    syncWithServer: () => Promise<void>;
    setOfflineMode: (offline: boolean) => void;
}

/**
 * Create study store with persistence and dev tools
 */
export const useStudyStore = create<StudyState & StudyActions>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                currentSession: null,
                currentCard: null,
                isLoading: false,
                error: null,
                studyStreak: 0,
                performance: {
                    totalCards: 0,
                    correctCount: 0,
                    incorrectCount: 0,
                    averageConfidence: 0,
                    studyStreak: 0,
                    timeSpent: 0,
                    fsrsProgress: {
                        averageStability: 0,
                        averageDifficulty: 0,
                        retentionRate: 0,
                        stabilityGrowthRate: 0,
                        difficultyGrowthRate: 0
                    },
                    retentionRate: 0
                },
                voiceMode: {
                    enabled: false,
                    state: VoiceRecognitionState.IDLE,
                    error: null
                },
                syncStatus: {
                    lastSync: Date.now(),
                    isOnline: navigator.onLine,
                    pendingSync: false
                },
                offlineMode: false,

                // Actions
                startSession: async (settings: StudySessionSettings) => {
                    try {
                        set({ isLoading: true, error: null });

                        const session = await studyService.startStudySession(settings);
                        
                        if (settings.voiceEnabled) {
                            await voiceService.initializeVoiceService({
                                language: settings.voiceLanguage,
                                confidenceThreshold: settings.voiceConfidenceThreshold
                            });
                            await voiceService.startVoiceStudySession(session.id);
                        }

                        const firstCard = await studyService.getNextCard();

                        set({
                            currentSession: session,
                            currentCard: firstCard,
                            voiceMode: {
                                ...get().voiceMode,
                                enabled: settings.voiceEnabled
                            }
                        });
                    } catch (error) {
                        set({ error: (error as Error).message });
                    } finally {
                        set({ isLoading: false });
                    }
                },

                endSession: async () => {
                    try {
                        set({ isLoading: true, error: null });
                        
                        const { currentSession, voiceMode } = get();
                        if (!currentSession) return;

                        if (voiceMode.enabled) {
                            await voiceService.stopVoiceStudySession();
                        }

                        await studyService.endStudySession();
                        
                        set({
                            currentSession: null,
                            currentCard: null,
                            voiceMode: {
                                enabled: false,
                                state: VoiceRecognitionState.IDLE,
                                error: null
                            }
                        });
                    } catch (error) {
                        set({ error: (error as Error).message });
                    } finally {
                        set({ isLoading: false });
                    }
                },

                submitReview: async (confidence: number) => {
                    const { currentSession, currentCard, voiceMode, offlineMode } = get();
                    if (!currentSession || !currentCard) return;

                    try {
                        set({ isLoading: true, error: null });

                        let voiceData;
                        if (voiceMode.enabled) {
                            const result = await voiceService.processVoiceAnswer({
                                transcript: '',
                                confidence: 0,
                                isFinal: true,
                                alternatives: [],
                                timestamp: Date.now(),
                                duration: 0
                            }, currentCard.id);
                            voiceData = { transcript: result.transcript, confidence: result.confidence };
                        }

                        await studyService.submitCardReview(
                            currentCard.id,
                            confidence,
                            voiceData
                        );

                        if (!offlineMode) {
                            await get().syncWithServer();
                        }

                        await get().loadNextCard();
                    } catch (error) {
                        set({ error: (error as Error).message });
                    } finally {
                        set({ isLoading: false });
                    }
                },

                toggleVoiceMode: async () => {
                    const { voiceMode, currentSession } = get();
                    if (!currentSession) return;

                    try {
                        set({ isLoading: true, error: null });

                        if (voiceMode.enabled) {
                            await voiceService.stopVoiceStudySession();
                        } else {
                            await voiceService.initializeVoiceService();
                            await voiceService.startVoiceStudySession(currentSession.id);
                        }

                        set({
                            voiceMode: {
                                ...voiceMode,
                                enabled: !voiceMode.enabled,
                                state: !voiceMode.enabled ? 
                                    VoiceRecognitionState.LISTENING : 
                                    VoiceRecognitionState.IDLE
                            }
                        });
                    } catch (error) {
                        set({ error: (error as Error).message });
                    } finally {
                        set({ isLoading: false });
                    }
                },

                loadNextCard: async () => {
                    const { currentSession } = get();
                    if (!currentSession) return;

                    try {
                        const nextCard = await studyService.getNextCard();
                        set({ currentCard: nextCard });
                    } catch (error) {
                        set({ error: (error as Error).message });
                    }
                },

                setError: (error: string | null) => set({ error }),

                updatePerformance: (metrics: Partial<StudyPerformance>) => 
                    set(state => ({
                        performance: { ...state.performance, ...metrics }
                    })),

                syncWithServer: async () => {
                    const { currentSession, syncStatus } = get();
                    if (!currentSession || !navigator.onLine) {
                        set({ syncStatus: { ...syncStatus, pendingSync: true } });
                        return;
                    }

                    try {
                        await studyService.submitCardReview(
                            currentSession.id,
                            0,
                            undefined
                        );
                        
                        set({
                            syncStatus: {
                                lastSync: Date.now(),
                                isOnline: true,
                                pendingSync: false
                            }
                        });
                    } catch (error) {
                        set({
                            syncStatus: { ...syncStatus, pendingSync: true },
                            error: (error as Error).message
                        });
                    }
                },

                setOfflineMode: (offline: boolean) => 
                    set({ offlineMode: offline })
            }),
            {
                name: 'study-store',
                partialize: (state) => ({
                    studyStreak: state.studyStreak,
                    performance: state.performance,
                    offlineMode: state.offlineMode
                })
            }
        )
    )
);