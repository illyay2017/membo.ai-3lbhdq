import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { useVoiceRecognition } from '../../src/hooks/useVoiceRecognition';
import { VoiceRecognitionState } from '../../src/types/voice';

// Mock configuration constants
const mockConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  confidenceThreshold: 0.85,
  timeout: 5000,
  retryAttempts: 3,
  retryInterval: 1000
};

// Test timeouts
const TEST_TIMEOUTS = {
  recognition: 100,
  stateTransition: 50,
  cleanup: 150
};

/**
 * Creates a comprehensive mock SpeechRecognition instance
 */
function mockSpeechRecognition() {
  const mockRecognition = {
    // Properties
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 1,
    grammars: null,

    // Event handlers
    onstart: null as any,
    onend: null as any,
    onresult: null as any,
    onerror: null as any,
    onaudiostart: null as any,
    onaudioend: null as any,
    onsoundstart: null as any,
    onsoundend: null as any,
    onspeechstart: null as any,
    onspeechend: null as any,
    onnomatch: null as any,

    // Methods
    start: jest.fn(() => {
      if (mockRecognition.onstart) {
        mockRecognition.onstart();
      }
    }),
    stop: jest.fn(() => {
      if (mockRecognition.onend) {
        mockRecognition.onend();
      }
    }),
    abort: jest.fn(),
    addEventListener: jest.fn((event: string, handler: () => void) => {
      (mockRecognition as any)[`on${event}`] = handler;
    }),
    removeEventListener: jest.fn((event: string, handler: () => void) => {
      if ((mockRecognition as any)[`on${event}`] === handler) {
        (mockRecognition as any)[`on${event}`] = null;
      }
    })
  };

  return mockRecognition;
}

/**
 * Simulates a speech recognition result event
 */
function simulateRecognitionResult(transcript: string, confidence: number = 0.9) {
  const mockResult = {
    results: [{
      0: {
        transcript,
        confidence
      },
      isFinal: true,
      length: 1
    }],
    resultIndex: 0
  };

  return new CustomEvent('result', { detail: mockResult });
}

describe('useVoiceRecognition', () => {
  let mockSpeechRecognitionInstance: ReturnType<typeof mockSpeechRecognition>;
  let originalWindow: any;

  beforeEach(() => {
    mockSpeechRecognitionInstance = mockSpeechRecognition();
    originalWindow = global.window;

    // Mock window with SpeechRecognition
    const mockWindow = {
      ...originalWindow,
      SpeechRecognition: jest.fn(() => mockSpeechRecognitionInstance),
      webkitSpeechRecognition: jest.fn(() => mockSpeechRecognitionInstance)
    };
    global.window = mockWindow;
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVoiceRecognition());

    expect(result.current.state).toBe(VoiceRecognitionState.IDLE);
    expect(result.current.transcript).toBe('');
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockSpeechRecognitionInstance.lang).toBe(mockConfig.language);
    expect(mockSpeechRecognitionInstance.continuous).toBe(mockConfig.continuous);
    expect(mockSpeechRecognitionInstance.interimResults).toBe(mockConfig.interimResults);
  });

  it('should handle browser compatibility', () => {
    // Test webkit prefix
    global.window.SpeechRecognition = undefined;
    const { result } = renderHook(() => useVoiceRecognition());
    expect(result.current.browserSupport.isSupported).toBe(true);

    // Test unsupported browser
    global.window.webkitSpeechRecognition = undefined;
    const { result: unsupportedResult } = renderHook(() => useVoiceRecognition());
    expect(unsupportedResult.current.browserSupport.isSupported).toBe(false);
    expect(unsupportedResult.current.error).not.toBeNull();
  });

  it('should manage recognition lifecycle', async () => {
    const { result } = renderHook(() => useVoiceRecognition(mockConfig));

    // Start recognition
    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.state).toBe(VoiceRecognitionState.LISTENING);
    expect(mockSpeechRecognitionInstance.start).toHaveBeenCalled();

    // Verify timeout setup
    jest.advanceTimersByTime(mockConfig.timeout);
    expect(result.current.state).toBe(VoiceRecognitionState.IDLE);

    // Stop recognition
    await act(async () => {
      await result.current.stopListening();
    });

    expect(result.current.state).toBe(VoiceRecognitionState.IDLE);
    expect(mockSpeechRecognitionInstance.stop).toHaveBeenCalled();
  });

  it('should process recognition results', async () => {
    const { result } = renderHook(() => useVoiceRecognition(mockConfig));

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate multiple results
    await act(async () => {
      const event = simulateRecognitionResult('test transcript', 0.95);
      mockSpeechRecognitionInstance.onresult?.(event);
    });

    expect(result.current.transcript).toBe('test transcript');

    // Test confidence threshold
    await act(async () => {
      const lowConfidenceEvent = simulateRecognitionResult('low confidence', 0.5);
      mockSpeechRecognitionInstance.onresult?.(lowConfidenceEvent);
    });

    expect(result.current.transcript).not.toBe('low confidence');
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useVoiceRecognition(mockConfig));

    // Simulate network error
    await act(async () => {
      mockSpeechRecognitionInstance.onerror?.({
        error: 'network',
        message: 'Network error occurred'
      });
    });

    expect(result.current.state).toBe(VoiceRecognitionState.ERROR);
    expect(result.current.error).not.toBeNull();

    // Test recovery
    await act(async () => {
      await result.current.retryRecognition();
    });

    expect(result.current.state).toBe(VoiceRecognitionState.LISTENING);
    expect(result.current.error).toBeNull();
  });

  it('should cleanup resources properly', async () => {
    const { result, unmount } = renderHook(() => useVoiceRecognition(mockConfig));

    await act(async () => {
      await result.current.startListening();
    });

    // Unmount hook
    unmount();

    expect(mockSpeechRecognitionInstance.stop).toHaveBeenCalled();
    expect(mockSpeechRecognitionInstance.removeEventListener).toHaveBeenCalled();
  });

  it('should track performance metrics', async () => {
    const { result } = renderHook(() => useVoiceRecognition(mockConfig));

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate successful recognition
    await act(async () => {
      const event = simulateRecognitionResult('test', 0.95);
      mockSpeechRecognitionInstance.onresult?.(event);
    });

    expect(result.current.performance.processingTimes.length).toBeGreaterThan(0);
    expect(result.current.performance.errorCount).toBe(0);
  });
});