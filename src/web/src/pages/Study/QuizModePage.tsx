/**
 * Advanced quiz mode study interface with AI-generated questions,
 * voice interaction capabilities, and comprehensive performance analytics.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import CardDisplay from '../../components/study/CardDisplay';
import ProgressBar from '../../components/study/ProgressBar';
import { useStudySession } from '../../hooks/useStudySession';
import Button from '../../components/ui/button';
import { STUDY_MODES, STUDY_MODE_CONFIG } from '../../constants/study';
import { Card } from '../../types/card';

// Quiz mode configuration constants
const QUIZ_CONFIG = {
  questionsPerQuiz: STUDY_MODE_CONFIG[STUDY_MODES.QUIZ].questionsPerQuiz,
  timeLimit: STUDY_MODE_CONFIG[STUDY_MODES.QUIZ].quizTimeLimit,
  passingScore: 0.7,
  performanceTarget: STUDY_MODE_CONFIG[STUDY_MODES.QUIZ].performanceImprovementTarget,
  voiceEnabled: false,
  adaptiveDifficulty: true,
  showExplanations: true,
  retryIncorrect: true
};

// Quiz session state interface
interface QuizState {
  currentQuestion: number;
  timeRemaining: number;
  score: number;
  incorrectAnswers: Card[];
  performance: {
    correctStreak: number;
    averageResponseTime: number;
    confidenceScores: number[];
  };
}

/**
 * QuizModePage component implementing advanced quiz study interface
 */
const QuizModePage: React.FC = () => {
  const navigate = useNavigate();
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    timeRemaining: QUIZ_CONFIG.timeLimit,
    score: 0,
    incorrectAnswers: [],
    performance: {
      correctStreak: 0,
      averageResponseTime: 0,
      confidenceScores: []
    }
  });

  // Initialize study session with quiz mode configuration
  const {
    session,
    currentCard,
    isLoading,
    error,
    performance,
    voiceMode,
    submitReview,
    startSession,
    endSession,
    loadNextCard
  } = useStudySession({
    sessionDuration: QUIZ_CONFIG.timeLimit,
    cardsPerSession: QUIZ_CONFIG.questionsPerQuiz,
    showConfidenceButtons: true,
    enableFSRS: false,
    voiceEnabled: QUIZ_CONFIG.voiceEnabled
  });

  // WebSocket connection for real-time updates
  const [socket, setSocket] = useState<any>(null);

  /**
   * Initialize quiz session and WebSocket connection
   */
  const initializeQuiz = useCallback(async () => {
    try {
      await startSession({
        mode: STUDY_MODES.QUIZ,
        settings: {
          questionsPerQuiz: QUIZ_CONFIG.questionsPerQuiz,
          timeLimit: QUIZ_CONFIG.timeLimit,
          voiceEnabled: QUIZ_CONFIG.voiceEnabled
        }
      });

      // Initialize WebSocket connection
      const newSocket = io(process.env.VITE_API_BASE_URL || '', {
        path: '/ws',
        transports: ['websocket']
      });

      newSocket.on('quizUpdate', handleQuizUpdate);
      setSocket(newSocket);

    } catch (error) {
      console.error('Failed to initialize quiz:', error);
    }
  }, [startSession]);

  /**
   * Handle quiz answer submission with performance tracking
   */
  const handleAnswerSubmit = useCallback(async (
    answer: string,
    confidence: number
  ) => {
    if (!currentCard || !session) return;

    const startTime = performance.now();
    try {
      await submitReview(confidence);

      // Update performance metrics
      setQuizState(prev => {
        const responseTime = performance.now() - startTime;
        const isCorrect = confidence >= 0.7;

        return {
          ...prev,
          score: isCorrect ? prev.score + 1 : prev.score,
          incorrectAnswers: isCorrect ? 
            prev.incorrectAnswers : 
            [...prev.incorrectAnswers, currentCard],
          performance: {
            correctStreak: isCorrect ? prev.performance.correctStreak + 1 : 0,
            averageResponseTime: (
              (prev.performance.averageResponseTime * prev.currentQuestion + responseTime) /
              (prev.currentQuestion + 1)
            ),
            confidenceScores: [...prev.performance.confidenceScores, confidence]
          },
          currentQuestion: prev.currentQuestion + 1
        };
      });

      // Emit progress update through WebSocket
      socket?.emit('quizProgress', {
        sessionId: session.id,
        currentQuestion: quizState.currentQuestion + 1,
        score: quizState.score,
        performance: quizState.performance
      });

      await loadNextCard();
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  }, [currentCard, session, submitReview, loadNextCard, socket, quizState]);

  /**
   * Handle real-time quiz updates from WebSocket
   */
  const handleQuizUpdate = useCallback((data: any) => {
    if (data.sessionId === session?.id) {
      setQuizState(prev => ({
        ...prev,
        ...data.updates
      }));
    }
  }, [session]);

  /**
   * Handle quiz completion and cleanup
   */
  const handleQuizComplete = useCallback(async () => {
    try {
      if (session) {
        await endSession();
        
        // Calculate final performance metrics
        const finalScore = quizState.score / QUIZ_CONFIG.questionsPerQuiz;
        const performanceImprovement = 
          (finalScore - performance.retentionRate) / performance.retentionRate * 100;

        // Emit completion event
        socket?.emit('quizComplete', {
          sessionId: session.id,
          finalScore,
          performanceImprovement,
          performance: quizState.performance
        });

        navigate('/study/summary', { 
          state: { 
            quizResults: {
              score: finalScore,
              improvement: performanceImprovement,
              performance: quizState.performance,
              incorrectAnswers: quizState.incorrectAnswers
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to complete quiz:', error);
    }
  }, [session, endSession, navigate, quizState, performance.retentionRate]);

  // Initialize quiz session
  useEffect(() => {
    initializeQuiz();
    return () => {
      socket?.disconnect();
      endSession();
    };
  }, [initializeQuiz, endSession]);

  // Timer countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setQuizState(prev => {
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          clearInterval(timer);
          handleQuizComplete();
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleQuizComplete]);

  // Handle quiz completion
  useEffect(() => {
    if (quizState.currentQuestion >= QUIZ_CONFIG.questionsPerQuiz) {
      handleQuizComplete();
    }
  }, [quizState.currentQuestion, handleQuizComplete]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-semibold text-error mb-4">
          Failed to load quiz
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
        <Button onClick={initializeQuiz}>Retry Quiz</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Quiz header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          Quiz Mode
        </h1>
        <div className="text-lg font-medium">
          Time: {Math.floor(quizState.timeRemaining / 60)}:
          {(quizState.timeRemaining % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Progress tracking */}
      <div className="space-y-2">
        <ProgressBar
          current={quizState.currentQuestion}
          total={QUIZ_CONFIG.questionsPerQuiz}
          variant={quizState.score / quizState.currentQuestion >= QUIZ_CONFIG.passingScore ? 
            'success' : 'warning'}
          showPercentage
          className="mb-4"
        />
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Question {quizState.currentQuestion + 1} of {QUIZ_CONFIG.questionsPerQuiz}</span>
          <span>Score: {Math.round(quizState.score / QUIZ_CONFIG.questionsPerQuiz * 100)}%</span>
        </div>
      </div>

      {/* Current question */}
      {currentCard && (
        <CardDisplay
          card={currentCard}
          isVoiceMode={voiceMode.enabled}
          onAnswer={handleAnswerSubmit}
          className="shadow-lg rounded-lg"
        />
      )}

      {/* Performance metrics */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Correct Streak
          </div>
          <div className="text-xl font-semibold">
            {quizState.performance.correctStreak}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Avg Response Time
          </div>
          <div className="text-xl font-semibold">
            {Math.round(quizState.performance.averageResponseTime / 1000)}s
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Avg Confidence
          </div>
          <div className="text-xl font-semibold">
            {quizState.performance.confidenceScores.length > 0 ?
              Math.round(
                quizState.performance.confidenceScores.reduce((a, b) => a + b, 0) /
                quizState.performance.confidenceScores.length * 100
              ) : 0}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizModePage;