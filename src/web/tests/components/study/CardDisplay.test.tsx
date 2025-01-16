import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import CardDisplay from '../../../src/components/study/CardDisplay';
import { generateMockCard } from '../../utils/testHelpers';
import { VoiceRecognitionState } from '../../../src/types/voice';
import { CONFIDENCE_LEVELS } from '../../../src/constants/study';

// Mock hooks and services
vi.mock('../../../src/hooks/useStudySession', () => ({
  useStudySession: () => ({
    submitReview: vi.fn(),
    voiceMode: { enabled: false, state: VoiceRecognitionState.IDLE },
    isLoading: false,
    error: null
  })
}));

vi.mock('../../../src/hooks/useVoiceRecognition', () => ({
  useVoiceRecognition: () => ({
    state: VoiceRecognitionState.IDLE,
    transcript: '',
    isListening: false,
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    confidence: 0
  })
}));

describe('CardDisplay', () => {
  // Test setup
  const mockOnAnswer = vi.fn();
  const mockOnConfidenceRating = vi.fn();
  const mockOnVoiceInput = vi.fn();
  const mockPerformanceTracker = vi.fn();
  let testCard;

  beforeEach(() => {
    vi.clearAllMocks();
    testCard = generateMockCard();
    // Reset performance monitoring
    performance.mark('card-display-start');
  });

  describe('Rendering', () => {
    test('renders front content initially', () => {
      render(<CardDisplay card={testCard} />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
      expect(screen.getByText(/Question/i)).toBeInTheDocument();
      expect(screen.getByText(testCard.frontContent.text)).toBeInTheDocument();
      expect(screen.queryByText(/Answer/i)).not.toBeInTheDocument();
    });

    test('applies correct visual states based on card state', () => {
      const { rerender } = render(<CardDisplay card={testCard} />);
      
      // Test default state
      expect(screen.getByRole('article')).toHaveClass('bg-white dark:bg-gray-800');
      
      // Test revealed state
      fireEvent.click(screen.getByText(/Show Answer/i));
      expect(screen.getByRole('article')).toHaveClass('bg-gray-50 dark:bg-gray-700');
      
      // Test processing state
      rerender(<CardDisplay card={testCard} isVoiceMode={true} />);
      expect(screen.getByRole('article')).toHaveClass('bg-blue-50 dark:bg-blue-900');
    });

    test('renders voice controls when voice mode is enabled', () => {
      render(<CardDisplay card={testCard} isVoiceMode={true} />);
      
      expect(screen.getByRole('region', { name: /Voice controls/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start voice recognition/i })).toBeInTheDocument();
    });

    test('renders confidence buttons after revealing answer', async () => {
      render(<CardDisplay card={testCard} onConfidenceRating={mockOnConfidenceRating} />);
      
      fireEvent.click(screen.getByText(/Show Answer/i));
      
      const confidenceButtons = screen.getByRole('group', { name: /Rate your confidence level/i });
      expect(confidenceButtons).toBeInTheDocument();
      expect(within(confidenceButtons).getAllByRole('button')).toHaveLength(4);
    });
  });

  describe('Interactions', () => {
    test('handles card flip interaction', async () => {
      render(<CardDisplay card={testCard} />);
      
      const showAnswerButton = screen.getByText(/Show Answer/i);
      await userEvent.click(showAnswerButton);
      
      expect(screen.getByText(/Answer/i)).toBeInTheDocument();
      expect(screen.getByText(testCard.backContent.text)).toBeInTheDocument();
    });

    test('submits confidence rating', async () => {
      render(<CardDisplay card={testCard} onConfidenceRating={mockOnConfidenceRating} />);
      
      // Reveal answer
      fireEvent.click(screen.getByText(/Show Answer/i));
      
      // Submit confidence rating
      const goodButton = screen.getByRole('button', { name: /Rate as correct with some difficulty/i });
      await userEvent.click(goodButton);
      
      expect(mockOnConfidenceRating).toHaveBeenCalledWith(CONFIDENCE_LEVELS.GOOD);
    });

    test('handles voice input processing', async () => {
      render(
        <CardDisplay 
          card={testCard} 
          isVoiceMode={true}
          onAnswer={mockOnAnswer}
        />
      );
      
      // Simulate voice input
      const voiceButton = screen.getByRole('button', { name: /Start voice recognition/i });
      await userEvent.click(voiceButton);
      
      // Wait for voice processing
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    test('tracks performance metrics', async () => {
      const { unmount } = render(<CardDisplay card={testCard} />);
      
      // Measure initial render performance
      const initialMark = performance.getEntriesByName('card-display-start')[0];
      expect(initialMark).toBeDefined();
      
      // Cleanup
      unmount();
      performance.clearMarks();
    });
  });

  describe('Accessibility', () => {
    test('provides appropriate ARIA labels and roles', () => {
      render(<CardDisplay card={testCard} />);
      
      expect(screen.getByRole('article', { name: /Study card/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reveal answer/i })).toBeInTheDocument();
    });

    test('manages focus appropriately', async () => {
      render(<CardDisplay card={testCard} />);
      
      const showAnswerButton = screen.getByText(/Show Answer/i);
      await userEvent.tab();
      expect(showAnswerButton).toHaveFocus();
      
      await userEvent.click(showAnswerButton);
      const confidenceButtons = within(screen.getByRole('group')).getAllByRole('button');
      expect(confidenceButtons[0]).toHaveFocus();
    });

    test('supports keyboard navigation', async () => {
      render(<CardDisplay card={testCard} />);
      
      await userEvent.tab();
      await userEvent.keyboard('{enter}');
      
      expect(screen.getByText(/Answer/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('displays error state appropriately', async () => {
      const errorMessage = 'Voice recognition failed';
      render(
        <CardDisplay 
          card={testCard} 
          isVoiceMode={true}
          onError={(error) => console.error(error)}
        />
      );
      
      // Simulate error
      act(() => {
        const errorEvent = new ErrorEvent('error', { error: new Error(errorMessage) });
        window.dispatchEvent(errorEvent);
      });
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    test('recovers from non-fatal errors', async () => {
      const { rerender } = render(
        <CardDisplay 
          card={testCard} 
          isVoiceMode={true}
        />
      );
      
      // Simulate recoverable error
      act(() => {
        const errorEvent = new ErrorEvent('error', { 
          error: new Error('Temporary network issue')
        });
        window.dispatchEvent(errorEvent);
      });
      
      // Simulate recovery
      rerender(<CardDisplay card={testCard} isVoiceMode={true} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('renders within performance budget', async () => {
      const start = performance.now();
      
      render(<CardDisplay card={testCard} />);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200); // 200ms budget
    });

    test('handles rapid interactions without degradation', async () => {
      render(<CardDisplay card={testCard} />);
      
      // Simulate rapid interactions
      for (let i = 0; i < 10; i++) {
        await userEvent.click(screen.getByText(/Show Answer/i));
        await userEvent.click(screen.getByText(/Question/i));
      }
      
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});