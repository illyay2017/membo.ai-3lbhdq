package ai.membo.managers;

import android.content.Context;
import android.net.ConnectivityManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.SpeechRecognizer;
import android.util.Log;

import ai.membo.constants.VoiceConstants;
import ai.membo.constants.VoiceConstants.VoiceRecognitionState;
import ai.membo.constants.VoiceConstants.VoiceRecognitionError;
import ai.membo.utils.AudioSessionManager;
import ai.membo.utils.PermissionManager;

/**
 * Core manager class responsible for handling voice recognition and processing in the Android application.
 * Implements voice-first interaction capabilities with robust error handling and resource management.
 *
 * @version 1.0
 * @since 2024-01
 */
public class VoiceManager {
    private static final String TAG = "VoiceManager";
    private static final long BACKOFF_BASE_MS = 1000;

    private final Context mContext;
    private final AudioSessionManager mAudioSessionManager;
    private final PermissionManager mPermissionManager;
    private final Handler mTimeoutHandler;
    private final PowerManager mPowerManager;
    private final ConnectivityManager mConnectivityManager;
    private final Bundle mSavedState;

    private SpeechRecognizer mSpeechRecognizer;
    private VoiceRecognitionCallback mCallback;
    private @VoiceRecognitionState int mCurrentState;
    private int mRetryCount;
    private long mLastRetryTimestamp;

    /**
     * Callback interface for voice recognition events
     */
    public interface VoiceRecognitionCallback {
        void onRecognitionStarted();
        void onRecognitionResult(String result, float confidence);
        void onRecognitionError(@VoiceRecognitionError int errorCode);
        void onRecognitionEnded();
    }

    /**
     * Constructs a new VoiceManager instance
     *
     * @param context The application context
     * @param audioSessionManager The audio session manager instance
     * @param permissionManager The permission manager instance
     */
    public VoiceManager(Context context, AudioSessionManager audioSessionManager, 
                       PermissionManager permissionManager) {
        mContext = context.getApplicationContext();
        mAudioSessionManager = audioSessionManager;
        mPermissionManager = permissionManager;
        mTimeoutHandler = new Handler();
        
        // Initialize system services
        mPowerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        mConnectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        
        // Initialize state
        mCurrentState = VoiceConstants.STATE_IDLE;
        mRetryCount = 0;
        mLastRetryTimestamp = 0;
        mSavedState = new Bundle();
    }

    /**
     * Starts voice recognition with the provided callback
     *
     * @param callback The recognition callback
     * @return boolean indicating if recognition started successfully
     */
    public synchronized boolean startVoiceRecognition(VoiceRecognitionCallback callback) {
        if (mCurrentState != VoiceConstants.STATE_IDLE) {
            Log.w(TAG, "Cannot start recognition in current state: " + mCurrentState);
            return false;
        }

        // Check prerequisites
        if (!checkPrerequisites()) {
            return false;
        }

        mCallback = callback;

        // Initialize audio session
        if (!mAudioSessionManager.initializeAudioSession()) {
            handleRecognitionError(VoiceConstants.ERROR_AUDIO_SESSION);
            return false;
        }

        // Initialize speech recognizer
        try {
            if (mSpeechRecognizer == null) {
                mSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(mContext);
                mSpeechRecognizer.setRecognitionListener(createRecognitionListener());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to create speech recognizer", e);
            handleRecognitionError(VoiceConstants.ERROR_NOT_AVAILABLE);
            return false;
        }

        // Start listening
        try {
            Bundle params = new Bundle();
            params.putInt(SpeechRecognizer.EXTRA_MAX_RESULTS, 1);
            mSpeechRecognizer.startListening(params);
            mCurrentState = VoiceConstants.STATE_LISTENING;
            
            // Set timeout
            mTimeoutHandler.postDelayed(this::handleTimeout, 
                VoiceConstants.VOICE_RECOGNITION_TIMEOUT_MS);
            
            mCallback.onRecognitionStarted();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start listening", e);
            handleRecognitionError(VoiceConstants.ERROR_UNKNOWN);
            return false;
        }
    }

    /**
     * Stops voice recognition and releases resources
     */
    public synchronized void stopVoiceRecognition() {
        mTimeoutHandler.removeCallbacksAndMessages(null);
        
        if (mSpeechRecognizer != null) {
            try {
                mSpeechRecognizer.stopListening();
                mSpeechRecognizer.cancel();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping speech recognizer", e);
            }
        }

        mAudioSessionManager.releaseAudioSession();
        mCurrentState = VoiceConstants.STATE_IDLE;
        mRetryCount = 0;
        mLastRetryTimestamp = 0;
        
        if (mCallback != null) {
            mCallback.onRecognitionEnded();
        }
    }

    /**
     * Handles recognition errors with retry mechanism
     *
     * @param errorCode The error code
     */
    private void handleRecognitionError(@VoiceRecognitionError int errorCode) {
        Log.e(TAG, "Recognition error: " + errorCode);
        mCurrentState = VoiceConstants.STATE_ERROR;

        // Check if retry is possible
        if (mRetryCount < VoiceConstants.MAX_RETRY_COUNT && 
            errorCode != VoiceConstants.ERROR_NO_PERMISSION) {
            
            long now = System.currentTimeMillis();
            long backoffDelay = BACKOFF_BASE_MS * (1 << mRetryCount);
            
            if (now - mLastRetryTimestamp >= backoffDelay) {
                mRetryCount++;
                mLastRetryTimestamp = now;
                mTimeoutHandler.postDelayed(() -> {
                    if (mCallback != null) {
                        startVoiceRecognition(mCallback);
                    }
                }, backoffDelay);
                return;
            }
        }

        if (mCallback != null) {
            mCallback.onRecognitionError(errorCode);
        }
    }

    /**
     * Creates the recognition listener for speech recognition callbacks
     *
     * @return RecognitionListener instance
     */
    private RecognitionListener createRecognitionListener() {
        return new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                mTimeoutHandler.removeCallbacksAndMessages(null);
            }

            @Override
            public void onBeginningOfSpeech() {
                mCurrentState = VoiceConstants.STATE_LISTENING;
            }

            @Override
            public void onRmsChanged(float rmsdB) {
                // Not implemented
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
                // Not implemented
            }

            @Override
            public void onEndOfSpeech() {
                mCurrentState = VoiceConstants.STATE_PROCESSING;
            }

            @Override
            public void onError(int error) {
                handleRecognitionError(mapSpeechRecognizerError(error));
            }

            @Override
            public void onResults(Bundle results) {
                if (results != null && results.containsKey(SpeechRecognizer.RESULTS_RECOGNITION)) {
                    ArrayList<String> matches = results.getStringArrayList(
                        SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] confidences = results.getFloatArray(
                        SpeechRecognizer.CONFIDENCE_SCORES);
                    
                    if (matches != null && !matches.isEmpty() && confidences != null) {
                        String result = matches.get(0);
                        float confidence = confidences[0];
                        
                        if (confidence >= VoiceConstants.VOICE_RECOGNITION_MIN_CONFIDENCE) {
                            mCurrentState = VoiceConstants.STATE_FINISHED;
                            if (mCallback != null) {
                                mCallback.onRecognitionResult(result, confidence);
                            }
                        } else {
                            handleRecognitionError(VoiceConstants.ERROR_UNKNOWN);
                        }
                    }
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                // Not implemented
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
                // Not implemented
            }
        };
    }

    /**
     * Checks all prerequisites before starting voice recognition
     *
     * @return boolean indicating if all prerequisites are met
     */
    private boolean checkPrerequisites() {
        // Check network connectivity
        if (!isNetworkAvailable()) {
            handleRecognitionError(VoiceConstants.ERROR_NETWORK);
            return false;
        }

        // Check power saving mode
        if (isPowerSavingMode()) {
            handleRecognitionError(VoiceConstants.ERROR_NOT_AVAILABLE);
            return false;
        }

        // Check microphone permission
        if (!mPermissionManager.checkMicrophonePermission()) {
            handleRecognitionError(VoiceConstants.ERROR_NO_PERMISSION);
            return false;
        }

        return true;
    }

    /**
     * Handles recognition timeout
     */
    private void handleTimeout() {
        if (mCurrentState == VoiceConstants.STATE_LISTENING) {
            handleRecognitionError(VoiceConstants.ERROR_TIMEOUT);
        }
    }

    /**
     * Maps SpeechRecognizer error codes to VoiceRecognitionError codes
     *
     * @param speechError The SpeechRecognizer error code
     * @return Mapped VoiceRecognitionError code
     */
    private @VoiceRecognitionError int mapSpeechRecognizerError(int speechError) {
        switch (speechError) {
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return VoiceConstants.ERROR_NETWORK;
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return VoiceConstants.ERROR_TIMEOUT;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return VoiceConstants.ERROR_NO_PERMISSION;
            default:
                return VoiceConstants.ERROR_UNKNOWN;
        }
    }

    /**
     * Checks if network is available
     *
     * @return boolean indicating network availability
     */
    private boolean isNetworkAvailable() {
        return mConnectivityManager.getActiveNetworkInfo() != null && 
               mConnectivityManager.getActiveNetworkInfo().isConnected();
    }

    /**
     * Checks if device is in power saving mode
     *
     * @return boolean indicating power saving mode
     */
    private boolean isPowerSavingMode() {
        return mPowerManager.isPowerSaveMode();
    }

    /**
     * Gets the current recognition state
     *
     * @return Current VoiceRecognitionState
     */
    public @VoiceRecognitionState int getCurrentState() {
        return mCurrentState;
    }

    /**
     * Handles low memory condition
     */
    public void onLowMemory() {
        if (mCurrentState == VoiceConstants.STATE_IDLE) {
            if (mSpeechRecognizer != null) {
                mSpeechRecognizer.destroy();
                mSpeechRecognizer = null;
            }
        }
    }

    /**
     * Handles configuration changes
     */
    public void onConfigurationChanged() {
        if (mSpeechRecognizer != null) {
            mSpeechRecognizer.destroy();
            mSpeechRecognizer = null;
        }
    }
}