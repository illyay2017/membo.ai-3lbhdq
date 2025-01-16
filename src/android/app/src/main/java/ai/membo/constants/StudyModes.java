package ai.membo.constants;

import androidx.annotation.NonNull; // Version: 1.6.0

/**
 * Defines the available study modes and their configurations for the Android application.
 * This class provides immutable constants for study mode types and their associated parameters.
 * 
 * Study modes include:
 * - Standard flashcard review
 * - Voice-enabled learning
 * - Quiz mode
 */
public final class StudyModes {

    /**
     * Standard flashcard review mode identifier
     */
    @NonNull
    public static final String STANDARD = "standard";

    /**
     * Voice-enabled learning mode identifier
     */
    @NonNull
    public static final String VOICE = "voice";

    /**
     * Quiz mode identifier
     */
    @NonNull
    public static final String QUIZ = "quiz";

    /**
     * Private constructor to prevent instantiation
     * @throws IllegalStateException if instantiation is attempted
     */
    private StudyModes() {
        throw new IllegalStateException("StudyModes utility class");
    }
}

/**
 * Configuration constants for study mode parameters.
 * Defines session durations, card limits, and mode-specific settings.
 */
public final class StudyModeConfig {

    /**
     * Duration of standard study session in seconds (1 hour)
     */
    public static final long STANDARD_SESSION_DURATION = 3600L;

    /**
     * Duration of voice study session in seconds (30 minutes)
     */
    public static final long VOICE_SESSION_DURATION = 1800L;

    /**
     * Duration of quiz session in seconds (45 minutes)
     */
    public static final long QUIZ_SESSION_DURATION = 2700L;

    /**
     * Minimum number of cards for standard study mode
     */
    public static final int STANDARD_MIN_CARDS = 10;

    /**
     * Maximum number of cards for standard study mode
     */
    public static final int STANDARD_MAX_CARDS = 50;

    /**
     * Minimum number of cards for voice study mode
     */
    public static final int VOICE_MIN_CARDS = 10;

    /**
     * Maximum number of cards for voice study mode
     */
    public static final int VOICE_MAX_CARDS = 30;

    /**
     * Minimum number of cards for quiz mode
     */
    public static final int QUIZ_MIN_CARDS = 20;

    /**
     * Maximum number of cards for quiz mode
     */
    public static final int QUIZ_MAX_CARDS = 50;

    /**
     * Confidence threshold for voice recognition accuracy (80%)
     */
    public static final float VOICE_CONFIDENCE_THRESHOLD = 0.8f;

    /**
     * Number of questions generated per quiz session
     */
    public static final int QUESTIONS_PER_QUIZ = 20;

    /**
     * Private constructor to prevent instantiation
     * @throws IllegalStateException if instantiation is attempted
     */
    private StudyModeConfig() {
        throw new IllegalStateException("StudyModeConfig utility class");
    }
}