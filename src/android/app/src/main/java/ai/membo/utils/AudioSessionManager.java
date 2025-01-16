package ai.membo.utils;

import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioFormat;
import android.content.Context;
import android.util.Log;

import ai.membo.constants.VoiceConstants;

/**
 * Thread-safe utility class responsible for managing audio sessions and configurations
 * for voice recognition features in the Android application.
 * 
 * This class handles:
 * - Audio resource initialization and configuration
 * - Audio focus management
 * - Safe resource cleanup
 * - Thread synchronization for audio operations
 */
public class AudioSessionManager {
    private static final String TAG = "AudioSessionManager";

    private final Context mContext;
    private final AudioManager mAudioManager;
    private AudioRecord mAudioRecord;
    private volatile boolean mIsSessionActive;
    private final Object mLock;

    /**
     * Initializes the AudioSessionManager with the required Android context.
     *
     * @param context The Android application context
     * @throws IllegalArgumentException if context is null
     */
    public AudioSessionManager(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("Context cannot be null");
        }

        mContext = context.getApplicationContext();
        mAudioManager = (AudioManager) mContext.getSystemService(Context.AUDIO_SERVICE);
        mLock = new Object();
        mIsSessionActive = false;
    }

    /**
     * Initializes and configures the audio session for voice recognition in a thread-safe manner.
     * 
     * @return boolean indicating success of initialization
     */
    public synchronized boolean initializeAudioSession() {
        synchronized (mLock) {
            if (mIsSessionActive) {
                Log.w(TAG, "Audio session is already active");
                return false;
            }

            try {
                // Calculate minimum buffer size for audio recording
                int minBufferSize = AudioRecord.getMinBufferSize(
                    VoiceConstants.AUDIO_SAMPLE_RATE,
                    VoiceConstants.AUDIO_CHANNEL_CONFIG,
                    VoiceConstants.AUDIO_ENCODING
                );

                if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                    Log.e(TAG, "Invalid buffer size calculated");
                    return false;
                }

                // Create AudioRecord instance with calculated buffer size
                mAudioRecord = new AudioRecord(
                    AudioManager.STREAM_VOICE_CALL,
                    VoiceConstants.AUDIO_SAMPLE_RATE,
                    VoiceConstants.AUDIO_CHANNEL_CONFIG,
                    VoiceConstants.AUDIO_ENCODING,
                    minBufferSize
                );

                if (mAudioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "AudioRecord initialization failed");
                    releaseAudioSession();
                    return false;
                }

                // Request audio focus
                int focusResult = mAudioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                );

                if (focusResult != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    Log.e(TAG, "Failed to obtain audio focus");
                    releaseAudioSession();
                    return false;
                }

                // Start recording
                mAudioRecord.startRecording();
                mIsSessionActive = true;
                Log.i(TAG, "Audio session initialized successfully");
                return true;

            } catch (SecurityException e) {
                Log.e(TAG, "Security exception during audio session initialization", e);
                releaseAudioSession();
                return false;
            } catch (IllegalStateException e) {
                Log.e(TAG, "IllegalState exception during audio session initialization", e);
                releaseAudioSession();
                return false;
            }
        }
    }

    /**
     * Safely releases all audio session resources in a thread-safe manner.
     */
    public synchronized void releaseAudioSession() {
        synchronized (mLock) {
            if (!mIsSessionActive) {
                return;
            }

            try {
                if (mAudioRecord != null) {
                    if (mAudioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                        mAudioRecord.stop();
                    }
                    mAudioRecord.release();
                    mAudioRecord = null;
                }

                mAudioManager.abandonAudioFocus(null);
                mIsSessionActive = false;
                Log.i(TAG, "Audio session released successfully");

            } catch (IllegalStateException e) {
                Log.e(TAG, "Error releasing audio session", e);
            } finally {
                mIsSessionActive = false;
            }
        }
    }

    /**
     * Checks if an audio session is currently active.
     *
     * @return boolean indicating if session is active
     */
    public synchronized boolean isSessionActive() {
        return mIsSessionActive;
    }
}