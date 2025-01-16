//
//  StudyManager.h
//  membo
//
//  Thread-safe singleton class managing study sessions, card scheduling,
//  and voice-based learning with enhanced statistics tracking.
//

@import Foundation; // iOS SDK 12.0+

#import "Constants/StudyModes.h"
#import "Utils/AudioSessionManager.h"

NS_ASSUME_NONNULL_BEGIN

#pragma mark - Protocol Declaration

/**
 * Protocol defining delegate methods for study session events with enhanced statistics reporting.
 * Implements comprehensive session tracking and voice input handling.
 */
@protocol MBStudyManagerDelegate <NSObject>

@required
/**
 * Called when a study session begins with specified mode and configuration.
 *
 * @param mode The active study mode for the session
 * @param config Configuration settings for the session
 */
- (void)didStartStudySession:(MBStudyMode)mode
                     config:(MBStudyModeConfig *)config;

/**
 * Called when a study session completes with comprehensive statistics.
 *
 * @param stats Dictionary containing detailed session statistics and metrics
 */
- (void)didCompleteStudySession:(NSDictionary<NSString *, NSNumber *> *)stats;

@optional
/**
 * Called when voice input is received during voice-enabled study mode.
 *
 * @param input The recognized voice input string
 * @param confidence The confidence level of voice recognition
 */
- (void)didReceiveVoiceInput:(NSString *)input
                 confidence:(CGFloat)confidence;

@end

#pragma mark - Class Interface

/**
 * Thread-safe singleton class managing study sessions and card scheduling
 * with comprehensive statistics tracking and voice learning support.
 */
@interface StudyManager : NSObject

#pragma mark - Properties

/// Delegate to receive study session events and statistics
@property (nonatomic, weak, nullable) id<MBStudyManagerDelegate> delegate;

/// Current active study mode
@property (nonatomic, assign, readonly) MBStudyMode currentMode;

/// Current study mode configuration
@property (nonatomic, strong, readonly) MBStudyModeConfig *currentConfig;

/// Flag indicating if a study session is currently active
@property (nonatomic, assign, readonly) BOOL isSessionActive;

/// Array of card IDs in the current study queue
@property (nonatomic, strong, readonly) NSArray<NSString *> *currentCardQueue;

/// Dictionary containing comprehensive session statistics
@property (nonatomic, strong, readonly) NSMutableDictionary<NSString *, NSNumber *> *sessionStats;

#pragma mark - Singleton Access

/**
 * Returns the thread-safe singleton instance of StudyManager.
 *
 * @return Shared StudyManager instance
 */
+ (instancetype)sharedInstance;

#pragma mark - Session Management

/**
 * Starts a new study session with specified mode and configuration.
 * Implements thread-safe session initialization and resource setup.
 *
 * @param mode The study mode to activate
 * @param config Configuration settings for the session
 * @return YES if session started successfully, NO otherwise
 */
- (BOOL)startStudySession:(MBStudyMode)mode
                  config:(MBStudyModeConfig *)config;

/**
 * Ends the current study session and processes results with enhanced statistics.
 * Performs thread-safe cleanup and delegate notification.
 */
- (void)endStudySession;

/**
 * Thread-safe processing of user response for current card with voice support.
 *
 * @param confidence User's confidence rating (1-5)
 * @param voiceInput Optional voice input for voice-enabled mode
 * @return YES if processing was successful, NO otherwise
 */
- (BOOL)processCardResponse:(NSInteger)confidence
                voiceInput:(nullable NSString *)voiceInput;

#pragma mark - Unavailable Initializers

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END