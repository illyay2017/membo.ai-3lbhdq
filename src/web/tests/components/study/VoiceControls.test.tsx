import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import VoiceControls from '../../../src/components/study/VoiceControls';
import { useVoiceRecognition } from '../../../src/hooks/useVoiceRecognition';
import { VoiceRecognitionState } from '../../../src/types/voice';
import { waitForElement } from '../../utils/testHelpers';

// Mock the voice recognition hook
vi.mock('../../../src/hooks/useVoiceRecognition');

describe('VoiceControls', () => {
  // Track timing for performance requirements
  let startTime: number;
  let endTime: number;

  // Default props for component
  const defaultProps = {
    onVoiceStart: vi.fn(),
    onVoiceEnd: vi.fn(),
    onError: vi.fn(),
    confidenceThreshold: 0.85,
    retryAttempts: 3
  };

  // Mock implementation of useVoiceRecognition
  const mockUseVoiceRecognition = {
    state: VoiceRecognitionState.IDLE,
    transcript: '',
    isListening: false,
    error: null,
    confidence: 0,
    startListening: vi.fn(() => {
      startTime = performance.now();
      return Promise.resolve();
    }),
    stopListening: vi.fn(() => {
      endTime = performance.now();
      return Promise.resolve();
    }),
    reset: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    startTime = 0;
    endTime = 0;
    (useVoiceRecognition as any).mockReturnValue(mockUseVoiceRecognition);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders voice controls with correct initial state', async () => {
    render(<VoiceControls {...defaultProps} />);

    // Verify voice toggle button presence and state
    const voiceButton = screen.getByRole('button', {
      name: /start voice recognition/i
    });
    expect(voiceButton).toBeInTheDocument();
    expect(voiceButton).toHaveAttribute('aria-pressed', 'false');

    // Verify accessibility attributes
    expect(voiceButton).toHaveAttribute('aria-label', 'Start voice recognition');
    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Voice controls');

    // Verify initial state indicators
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles voice activation with performance requirements', async () => {
    render(<VoiceControls {...defaultProps} />);

    // Start voice recognition
    const voiceButton = screen.getByRole('button');
    fireEvent.click(voiceButton);

    // Verify state transition
    await waitFor(() => {
      expect(mockUseVoiceRecognition.startListening).toHaveBeenCalled();
    });

    // Verify performance requirement (<10s)
    const activationTime = endTime - startTime;
    expect(activationTime).toBeLessThan(10000);

    // Verify feedback indicators
    await waitForElement('[role="meter"]');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Voice recognition confidence');
  });

  it('manages voice recognition states correctly', async () => {
    const { rerender } = render(<VoiceControls {...defaultProps} />);

    // Test idle state
    expect(screen.getByRole('button')).toHaveTextContent(/start voice/i);

    // Test listening state
    mockUseVoiceRecognition.isListening = true;
    mockUseVoiceRecognition.state = VoiceRecognitionState.LISTENING;
    rerender(<VoiceControls {...defaultProps} />);
    expect(screen.getByRole('button')).toHaveTextContent(/stop voice/i);

    // Test processing state with transcript
    mockUseVoiceRecognition.transcript = 'Test transcript';
    rerender(<VoiceControls {...defaultProps} />);
    expect(screen.getByText('Test transcript')).toBeInTheDocument();
  });

  it('handles errors and recovery gracefully', async () => {
    const { rerender } = render(<VoiceControls {...defaultProps} />);

    // Simulate permission denial error
    mockUseVoiceRecognition.error = {
      code: 'VOICE_PERMISSION_DENIED',
      message: 'Microphone access denied',
      timestamp: Date.now(),
      recoverable: false
    };
    rerender(<VoiceControls {...defaultProps} />);

    // Verify error display
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/microphone access denied/i);

    // Verify error callback
    expect(defaultProps.onError).toHaveBeenCalledWith({
      code: 'VOICE_PERMISSION_DENIED',
      message: 'Microphone access denied',
      retry: false
    });
  });

  it('updates confidence indicator correctly', async () => {
    const { rerender } = render(<VoiceControls {...defaultProps} />);

    // Test confidence below threshold
    mockUseVoiceRecognition.isListening = true;
    mockUseVoiceRecognition.confidence = 0.7;
    rerender(<VoiceControls {...defaultProps} />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '70');
    expect(within(meter).getByTitle(/confidence: 70%/i)).toBeInTheDocument();

    // Test confidence above threshold
    mockUseVoiceRecognition.confidence = 0.9;
    rerender(<VoiceControls {...defaultProps} />);
    expect(meter).toHaveAttribute('aria-valuenow', '90');
  });

  it('handles disabled state correctly', () => {
    render(<VoiceControls {...defaultProps} disabled />);

    const voiceButton = screen.getByRole('button');
    expect(voiceButton).toBeDisabled();
    
    fireEvent.click(voiceButton);
    expect(mockUseVoiceRecognition.startListening).not.toHaveBeenCalled();
  });

  it('cleans up resources on unmount', () => {
    const { unmount } = render(<VoiceControls {...defaultProps} />);
    unmount();
    expect(mockUseVoiceRecognition.stopListening).toHaveBeenCalled();
  });

  it('provides screen reader feedback', async () => {
    render(<VoiceControls {...defaultProps} />);

    // Verify initial state announcement
    expect(screen.getByText('', { selector: '.sr-only' })).toBeInTheDocument();

    // Verify state change announcements
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Voice recognition active. Speak your answer.')).toBeInTheDocument();
    });
  });
});