/**
 * @fileoverview TypeScript type definitions for voice recognition and processing functionality.
 * Supports voice-first interaction design and voice-enabled study capabilities.
 * @version 1.0.0
 */

/**
 * Comprehensive enum for tracking all possible voice recognition states
 * including initialization and pause states.
 */
export enum VoiceRecognitionState {
    INITIALIZING = 'INITIALIZING',
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    PROCESSING = 'PROCESSING',
    PAUSED = 'PAUSED',
    ERROR = 'ERROR'
}

/**
 * Extended interface for voice recognition configuration including
 * timeout, noise handling, and retry options.
 */
export interface VoiceRecognitionConfig {
    /** Primary language for speech recognition (e.g., 'en-US') */
    language: string;
    
    /** Whether to continuously recognize speech */
    continuous: boolean;
    
    /** Whether to return interim results while processing */
    interimResults: boolean;
    
    /** Maximum number of alternative transcriptions to return */
    maxAlternatives: number;
    
    /** Optional timeout in milliseconds for recognition */
    timeout?: number;
    
    /** Optional threshold for noise detection (0.0 to 1.0) */
    noiseThreshold?: number;
    
    /** Optional AudioContext for advanced audio processing */
    audioContext?: AudioContext;
    
    /** Optional number of retry attempts for failed recognition */
    retryAttempts?: number;
    
    /** Optional interval between retries in milliseconds */
    retryInterval?: number;
}

/**
 * Enhanced interface for voice recognition errors with timing,
 * details, and recovery information.
 */
export interface VoiceRecognitionError {
    /** Error code identifier */
    code: string;
    
    /** Human-readable error message */
    message: string;
    
    /** Timestamp when the error occurred */
    timestamp: number;
    
    /** Optional additional error details */
    details?: Record<string, unknown>;
    
    /** Whether the error can be automatically recovered from */
    recoverable: boolean;
}

/**
 * Comprehensive interface for voice recognition results including
 * alternatives and timing information.
 */
export interface VoiceRecognitionResult {
    /** Primary recognized transcript */
    transcript: string;
    
    /** Confidence score (0.0 to 1.0) */
    confidence: number;
    
    /** Whether this is a final result */
    isFinal: boolean;
    
    /** Alternative recognition results */
    alternatives: Array<{
        transcript: string;
        confidence: number;
    }>;
    
    /** Timestamp when the result was generated */
    timestamp: number;
    
    /** Duration of the recognized speech in milliseconds */
    duration: number;
}

/**
 * Complete interface for voice recognition event handlers including
 * audio, permission, and state change events.
 */
export interface VoiceRecognitionEventHandlers {
    /** Called when recognition starts */
    onStart: () => void;
    
    /** Called when a recognition result is available */
    onResult: (result: VoiceRecognitionResult) => void;
    
    /** Called when an error occurs */
    onError: (error: VoiceRecognitionError) => void;
    
    /** Called when recognition ends */
    onEnd: () => void;
    
    /** Called when recognition state changes */
    onStateChange: (state: VoiceRecognitionState) => void;
    
    /** Called when no match is found */
    onNoMatch: () => void;
    
    /** Called when audio capture starts */
    onAudioStart: () => void;
    
    /** Called when audio capture ends */
    onAudioEnd: () => void;
    
    /** Called when permission status changes */
    onPermissionChange: (granted: boolean) => void;
}