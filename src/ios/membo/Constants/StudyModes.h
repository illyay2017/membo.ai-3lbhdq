//
//  StudyModes.h
//  membo
//
//  Study mode constants, configurations and types for managing different learning modes
//  including standard flashcards, voice-enabled learning, and quiz modes with FSRS integration.
//

@import Foundation; // Foundation.framework iOS SDK 12.0+

NS_ASSUME_NONNULL_BEGIN

#pragma mark - Constants

/// Default study session duration in seconds (1 hour)
extern const NSTimeInterval MB_DEFAULT_SESSION_DURATION;

/// Default timeout for voice input recognition in seconds
extern const NSTimeInterval MB_DEFAULT_VOICE_TIMEOUT;

/// Minimum number of cards required per study session
extern const NSInteger MB_MIN_CARDS_PER_SESSION;

/// Maximum number of cards allowed per study session
extern const NSInteger MB_MAX_CARDS_PER_SESSION;

/// Default confidence threshold for voice recognition accuracy
extern const CGFloat MB_DEFAULT_VOICE_CONFIDENCE_THRESHOLD;

/// Minimum acceptable confidence threshold for voice recognition
extern const CGFloat MB_MIN_VOICE_CONFIDENCE_THRESHOLD;

#pragma mark - Enumerations

/**
 * Available study modes in the system.
 * Used to determine the behavior and configuration of study sessions.
 */
typedef NS_ENUM(NSInteger, MBStudyMode) {
    /// Standard flashcard study mode with manual card flipping
    MBStudyModeStandard = 0,
    /// Voice-enabled study mode with speech recognition
    MBStudyModeVoice = 1,
    /// Quiz mode with automated progression and scoring
    MBStudyModeQuiz = 2
};

/**
 * Error codes for study mode operations.
 * Used to identify specific failure conditions during study sessions.
 */
typedef NS_ENUM(NSInteger, MBStudyModeError) {
    /// Invalid study mode configuration provided
    MBStudyModeErrorInvalidConfiguration = -1,
    /// Voice recognition features are unavailable
    MBStudyModeErrorVoiceUnavailable = -2,
    /// FSRS algorithm support is disabled
    MBStudyModeErrorFSRSDisabled = -3
};

#pragma mark - Configuration Structure

/**
 * Configuration structure for study mode settings.
 * Defines parameters that control the behavior of study sessions.
 */
typedef struct {
    /// Duration of the study session in seconds
    NSTimeInterval sessionDuration;
    /// Flag indicating if voice input is allowed
    BOOL allowVoiceInput;
    /// Flag indicating if confidence rating buttons should be shown
    BOOL showConfidenceButtons;
    /// Flag indicating if FSRS algorithm is enabled
    BOOL enableFSRS;
    /// Minimum number of cards per session
    NSInteger minCardsPerSession;
    /// Maximum number of cards per session
    NSInteger maxCardsPerSession;
    /// Required confidence threshold for voice recognition
    CGFloat voiceConfidenceThreshold;
    /// Flag indicating if cards should advance automatically
    BOOL enableAutoAdvance;
    /// Duration to display each card before auto-advance
    NSTimeInterval cardDisplayDuration;
    /// Flag indicating if haptic feedback is enabled
    BOOL enableHapticFeedback;
} MBStudyModeConfig;

#pragma mark - Default Configurations

/**
 * Default configurations for each study mode.
 * Provides optimized settings for different study experiences.
 */
extern NSDictionary<NSNumber *, MBStudyModeConfig> *kMBDefaultStudyModeConfigs;

NS_ASSUME_NONNULL_END