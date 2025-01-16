/**
 * @fileoverview Core library for voice recognition functionality with enhanced error handling,
 * state management, and resource cleanup. Implements voice-first interaction design.
 * @version 1.0.0
 */

import { 
    VoiceRecognitionState, 
    VoiceRecognitionConfig, 
    VoiceRecognitionError,
    VoiceRecognitionResult 
} from '../types/voice';

// Web Speech API with webkit prefix fallback
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Default configuration for voice recognition
 */
const DEFAULT_CONFIG: VoiceRecognitionConfig = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
    timeout: 10000,
    confidenceThreshold: 0.8,
    retryAttempts: 3,
    retryInterval: 1000
};

/**
 * Current state of voice recognition
 */
let currentState: VoiceRecognitionState = VoiceRecognitionState.IDLE;

/**
 * Timeout reference for cleanup
 */
let timeoutRef: NodeJS.Timeout | null = null;

/**
 * Creates and configures a new SpeechRecognition instance with comprehensive error handling
 * @param config - Optional configuration overrides
 * @returns Promise resolving to configured speech recognition instance
 */
export const createVoiceRecognition = async (
    config?: Partial<VoiceRecognitionConfig>
): Promise<SpeechRecognition> => {
    if (!SpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser');
    }

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const recognition = new SpeechRecognition();

    // Configure basic properties
    recognition.lang = mergedConfig.language;
    recognition.continuous = mergedConfig.continuous;
    recognition.interimResults = mergedConfig.interimResults;
    recognition.maxAlternatives = mergedConfig.maxAlternatives;

    // Setup enhanced error handling
    recognition.onerror = async (event: ErrorEvent) => {
        await handleVoiceError(event.error, recognition);
    };

    // Configure result handling with confidence threshold
    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[event.results.length - 1];
        const voiceResult: VoiceRecognitionResult = {
            transcript: result[0].transcript,
            confidence: result[0].confidence,
            isFinal: result.isFinal,
            alternatives: Array.from(result).slice(1).map(alt => ({
                transcript: alt.transcript,
                confidence: alt.confidence
            })),
            timestamp: Date.now(),
            duration: event.timeStamp
        };

        if (voiceResult.confidence >= mergedConfig.confidenceThreshold) {
            currentState = VoiceRecognitionState.PROCESSING;
            // Emit result through custom event for decoupled handling
            recognition.dispatchEvent(new CustomEvent('voiceResult', { detail: voiceResult }));
        }
    };

    return recognition;
};

/**
 * Starts voice recognition with enhanced error handling and automatic retry
 * @param recognition - Configured SpeechRecognition instance
 * @returns Promise resolving when recognition starts successfully
 */
export const startVoiceRecognition = async (
    recognition: SpeechRecognition
): Promise<void> => {
    if (!recognition || currentState === VoiceRecognitionState.LISTENING) {
        return;
    }

    currentState = VoiceRecognitionState.INITIALIZING;

    try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Clean up test stream

        // Setup timeout handler
        if (DEFAULT_CONFIG.timeout) {
            timeoutRef = setTimeout(() => {
                stopVoiceRecognition(recognition);
            }, DEFAULT_CONFIG.timeout);
        }

        // Attempt to start recognition with retries
        let attempts = 0;
        const startRecognition = async (): Promise<void> => {
            try {
                recognition.start();
                currentState = VoiceRecognitionState.LISTENING;
            } catch (error) {
                if (attempts < DEFAULT_CONFIG.retryAttempts!) {
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.retryInterval));
                    await startRecognition();
                } else {
                    throw error;
                }
            }
        };

        await startRecognition();
    } catch (error) {
        await handleVoiceError(error, recognition);
    }
};

/**
 * Stops voice recognition with graceful shutdown and resource cleanup
 * @param recognition - Active SpeechRecognition instance
 * @returns Promise resolving when recognition stops cleanly
 */
export const stopVoiceRecognition = async (
    recognition: SpeechRecognition
): Promise<void> => {
    if (!recognition || currentState === VoiceRecognitionState.IDLE) {
        return;
    }

    try {
        // Clear any pending timeouts
        if (timeoutRef) {
            clearTimeout(timeoutRef);
            timeoutRef = null;
        }

        currentState = VoiceRecognitionState.PROCESSING;
        recognition.stop();
        
        // Clean up event listeners
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;

        currentState = VoiceRecognitionState.IDLE;
    } catch (error) {
        await handleVoiceError(error, recognition);
    }
};

/**
 * Handles voice recognition errors with recovery attempts and user feedback
 * @param error - Error object or string
 * @param recognition - Active SpeechRecognition instance
 * @returns Promise resolving when error is handled
 */
export const handleVoiceError = async (
    error: Error | string,
    recognition: SpeechRecognition
): Promise<void> => {
    const errorMessage = error instanceof Error ? error.message : error;
    
    const voiceError: VoiceRecognitionError = {
        code: 'VOICE_RECOGNITION_ERROR',
        message: errorMessage,
        timestamp: Date.now(),
        recoverable: isRecoverableError(errorMessage),
        details: {
            state: currentState,
            browserDetails: navigator.userAgent
        }
    };

    currentState = VoiceRecognitionState.ERROR;

    // Attempt recovery for recoverable errors
    if (voiceError.recoverable) {
        try {
            await stopVoiceRecognition(recognition);
            await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.retryInterval));
            await startVoiceRecognition(recognition);
            return;
        } catch (recoveryError) {
            voiceError.details!.recoveryError = recoveryError;
        }
    }

    // Emit error through custom event for decoupled handling
    recognition.dispatchEvent(new CustomEvent('voiceError', { detail: voiceError }));
};

/**
 * Determines if an error is recoverable based on its message
 * @param errorMessage - Error message to analyze
 * @returns boolean indicating if error is recoverable
 */
const isRecoverableError = (errorMessage: string): boolean => {
    const recoverableErrors = [
        'network',
        'no-speech',
        'audio-capture',
        'aborted'
    ];
    
    return recoverableErrors.some(error => 
        errorMessage.toLowerCase().includes(error.toLowerCase())
    );
};