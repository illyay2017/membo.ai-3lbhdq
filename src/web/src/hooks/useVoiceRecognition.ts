/**
 * @fileoverview Custom React hook for managing voice recognition functionality in study sessions.
 * Implements voice-first interaction design with comprehensive error handling and performance monitoring.
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    createVoiceRecognition, 
    startVoiceRecognition, 
    stopVoiceRecognition 
} from '../lib/voice';
import { 
    VoiceRecognitionState, 
    VoiceRecognitionConfig,
    VoiceRecognitionError 
} from '../types/voice';
import { useStudyStore } from '../store/studyStore';

/**
 * Interface for browser support information
 */
interface BrowserSupportInfo {
    isSupported: boolean;
    hasPermission: boolean;
    browserName: string;
    version: string;
}

/**
 * Interface for voice recognition performance metrics
 */
interface VoicePerformanceMetrics {
    averageLatency: number;
    recognitionRate: number;
    errorCount: number;
    processingTimes: number[];
    startTime: number | null;
}

/**
 * Custom hook for managing voice recognition in study sessions
 * @param config Optional voice recognition configuration
 */
export function useVoiceRecognition(config?: Partial<VoiceRecognitionConfig>) {
    // State management
    const [state, setState] = useState<VoiceRecognitionState>(VoiceRecognitionState.IDLE);
    const [transcript, setTranscript] = useState<string>('');
    const [error, setError] = useState<VoiceRecognitionError | null>(null);
    const [browserSupport, setBrowserSupport] = useState<BrowserSupportInfo>({
        isSupported: false,
        hasPermission: false,
        browserName: '',
        version: ''
    });
    const [performance, setPerformance] = useState<VoicePerformanceMetrics>({
        averageLatency: 0,
        recognitionRate: 0,
        errorCount: 0,
        processingTimes: [],
        startTime: null
    });

    // Refs for cleanup and performance tracking
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Study store integration
    const { handleVoiceResponse, persistVoiceState } = useStudyStore();

    /**
     * Checks browser compatibility and permissions
     */
    const checkBrowserSupport = useCallback(async (): Promise<void> => {
        const userAgent = navigator.userAgent;
        const browserInfo = {
            isSupported: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
            hasPermission: false,
            browserName: userAgent.includes('Chrome') ? 'Chrome' : 
                        userAgent.includes('Firefox') ? 'Firefox' : 
                        userAgent.includes('Safari') ? 'Safari' : 'Unknown',
            version: userAgent.match(/(?:Chrome|Firefox|Safari)\/(\d+)/)?.[1] || ''
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            browserInfo.hasPermission = true;
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            browserInfo.hasPermission = false;
        }

        setBrowserSupport(browserInfo);
    }, []);

    /**
     * Initializes voice recognition with error handling
     */
    const initializeRecognition = useCallback(async (): Promise<void> => {
        try {
            const recognition = await createVoiceRecognition({
                language: config?.language || 'en-US',
                continuous: true,
                interimResults: true,
                maxAlternatives: 3,
                confidenceThreshold: 0.8,
                retryAttempts: 3,
                retryInterval: 1000,
                ...config
            });

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const result = event.results[event.results.length - 1];
                if (result.isFinal) {
                    const processingTime = Date.now() - (performance.startTime || Date.now());
                    setPerformance(prev => ({
                        ...prev,
                        processingTimes: [...prev.processingTimes, processingTime],
                        averageLatency: calculateAverageLatency([...prev.processingTimes, processingTime])
                    }));

                    handleVoiceResponse({
                        transcript: result[0].transcript,
                        confidence: result[0].confidence,
                        isFinal: true,
                        alternatives: Array.from(result).slice(1).map(alt => ({
                            transcript: alt.transcript,
                            confidence: alt.confidence
                        })),
                        timestamp: Date.now(),
                        duration: processingTime
                    });
                }
                setTranscript(result[0].transcript);
            };

            recognition.onerror = async (event: ErrorEvent) => {
                await handleError({
                    code: 'VOICE_RECOGNITION_ERROR',
                    message: event.error,
                    timestamp: Date.now(),
                    recoverable: true,
                    details: { state, browserDetails: navigator.userAgent }
                });
            };

            recognitionRef.current = recognition;
        } catch (error) {
            await handleError({
                code: 'INITIALIZATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to initialize voice recognition',
                timestamp: Date.now(),
                recoverable: false,
                details: { state, browserDetails: navigator.userAgent }
            });
        }
    }, [config, state, handleVoiceResponse]);

    /**
     * Starts voice recognition with performance monitoring
     */
    const startListening = useCallback(async (): Promise<void> => {
        if (!recognitionRef.current || state === VoiceRecognitionState.LISTENING) {
            return;
        }

        try {
            setState(VoiceRecognitionState.INITIALIZING);
            setPerformance(prev => ({ ...prev, startTime: Date.now() }));
            
            await startVoiceRecognition(recognitionRef.current);
            setState(VoiceRecognitionState.LISTENING);
            
            // Auto-stop after timeout
            if (config?.timeout) {
                timeoutRef.current = setTimeout(async () => {
                    await stopListening();
                }, config.timeout);
            }

            persistVoiceState({ isListening: true });
        } catch (error) {
            await handleError({
                code: 'START_RECOGNITION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to start voice recognition',
                timestamp: Date.now(),
                recoverable: true,
                details: { state, browserDetails: navigator.userAgent }
            });
        }
    }, [state, config?.timeout, persistVoiceState]);

    /**
     * Stops voice recognition with cleanup
     */
    const stopListening = useCallback(async (): Promise<void> => {
        if (!recognitionRef.current || state === VoiceRecognitionState.IDLE) {
            return;
        }

        try {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            await stopVoiceRecognition(recognitionRef.current);
            setState(VoiceRecognitionState.IDLE);
            persistVoiceState({ isListening: false });
        } catch (error) {
            await handleError({
                code: 'STOP_RECOGNITION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to stop voice recognition',
                timestamp: Date.now(),
                recoverable: false,
                details: { state, browserDetails: navigator.userAgent }
            });
        }
    }, [state, persistVoiceState]);

    /**
     * Handles voice recognition errors with recovery attempts
     */
    const handleError = async (error: VoiceRecognitionError): Promise<void> => {
        setError(error);
        setState(VoiceRecognitionState.ERROR);
        setPerformance(prev => ({
            ...prev,
            errorCount: prev.errorCount + 1
        }));

        if (error.recoverable) {
            setState(VoiceRecognitionState.RETRYING);
            await stopListening();
            await new Promise(resolve => setTimeout(resolve, 1000));
            await startListening();
        }
    };

    /**
     * Calculates average latency from processing times
     */
    const calculateAverageLatency = (times: number[]): number => {
        return times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    };

    /**
     * Retry recognition after error
     */
    const retryRecognition = useCallback(async (): Promise<void> => {
        setError(null);
        await initializeRecognition();
        await startListening();
    }, [initializeRecognition, startListening]);

    // Initialize on mount
    useEffect(() => {
        checkBrowserSupport();
        initializeRecognition();

        return () => {
            if (recognitionRef.current) {
                stopListening();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [checkBrowserSupport, initializeRecognition, stopListening]);

    return {
        state,
        transcript,
        isListening: state === VoiceRecognitionState.LISTENING,
        error,
        startListening,
        stopListening,
        retryRecognition,
        performance,
        browserSupport
    };
}