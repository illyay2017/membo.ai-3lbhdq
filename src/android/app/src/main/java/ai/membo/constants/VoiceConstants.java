package ai.membo.constants;

import androidx.annotation.IntDef; // version: 1.6.0
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import android.media.AudioFormat;

/**
 * Constants, enums, and configuration values for voice recognition and audio processing features.
 * Provides type-safe enumerations for voice recognition states and error conditions, along with
 * audio configuration parameters used throughout the Android application.
 */
public final class VoiceConstants {

    private VoiceConstants() {
        // Prevent instantiation
    }

    /**
     * Maximum duration in milliseconds before voice recognition times out
     */
    public static final long VOICE_RECOGNITION_TIMEOUT_MS = 10000L;

    /**
     * Minimum confidence threshold (0.0-1.0) for accepting voice recognition results
     */
    public static final float VOICE_RECOGNITION_MIN_CONFIDENCE = 0.7f;

    /**
     * Maximum number of retry attempts for failed voice recognition operations
     */
    public static final int MAX_RETRY_COUNT = 3;

    /**
     * Audio recording sample rate in Hz
     */
    public static final int AUDIO_SAMPLE_RATE = 44100;

    /**
     * Audio channel configuration for recording
     */
    public static final int AUDIO_CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;

    /**
     * Audio encoding format for recording
     */
    public static final int AUDIO_ENCODING = AudioFormat.ENCODING_PCM_16BIT;

    /**
     * Possible states during the voice recognition process
     */
    @Retention(RetentionPolicy.SOURCE)
    @IntDef({
        STATE_IDLE,
        STATE_LISTENING,
        STATE_PROCESSING,
        STATE_FINISHED,
        STATE_ERROR
    })
    public @interface VoiceRecognitionState {}

    public static final int STATE_IDLE = 0;
    public static final int STATE_LISTENING = 1;
    public static final int STATE_PROCESSING = 2;
    public static final int STATE_FINISHED = 3;
    public static final int STATE_ERROR = 4;

    /**
     * Possible error conditions during voice recognition
     */
    @Retention(RetentionPolicy.SOURCE)
    @IntDef({
        ERROR_NO_PERMISSION,
        ERROR_NOT_AVAILABLE,
        ERROR_TIMEOUT,
        ERROR_AUDIO_SESSION,
        ERROR_NETWORK,
        ERROR_UNKNOWN
    })
    public @interface VoiceRecognitionError {}

    public static final int ERROR_NO_PERMISSION = 100;
    public static final int ERROR_NOT_AVAILABLE = 101;
    public static final int ERROR_TIMEOUT = 102;
    public static final int ERROR_AUDIO_SESSION = 103;
    public static final int ERROR_NETWORK = 104;
    public static final int ERROR_UNKNOWN = 199;
}