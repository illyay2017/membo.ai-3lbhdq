//
//  AudioSessionManager.h
//  membo
//
//  Created for membo.ai voice-based study features
//  Version: 1.0
//

#import <Foundation/Foundation.h>  // iOS SDK 12.0+
#import <AVFoundation/AVFoundation.h>  // iOS SDK 12.0+
#import "Constants/VoiceConstants.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * AudioSessionManager
 * Thread-safe singleton class responsible for managing audio session configuration 
 * and state for voice-based features with comprehensive error handling and state management.
 */
@interface AudioSessionManager : NSObject

/// Shared audio session instance for system-wide configuration
@property (nonatomic, strong, readonly) AVAudioSession *audioSession;

/// Flag indicating if audio session is currently active
@property (nonatomic, assign, readonly) BOOL isAudioSessionActive;

/// Most recent error encountered during audio session operations
@property (nonatomic, strong, readonly, nullable) NSError *lastError;

/// Thread-safe dictionary containing current session state
@property (nonatomic, strong, readonly) NSMutableDictionary *sessionState;

/// Array tracking interruption history for debugging and state restoration
@property (nonatomic, strong, readonly) NSMutableArray *interruptionHistory;

/**
 * Returns the shared singleton instance of AudioSessionManager.
 * Thread-safe implementation using GCD.
 *
 * @return The shared AudioSessionManager instance.
 */
+ (instancetype)sharedInstance;

/**
 * Configures the audio session with required settings for voice recording.
 * Thread-safe implementation with comprehensive error handling.
 *
 * @return YES if configuration was successful, NO otherwise with lastError set.
 */
- (BOOL)configureAudioSession;

/**
 * Activates the audio session for recording with error handling.
 * Thread-safe implementation that updates session state.
 *
 * @return YES if activation was successful, NO otherwise with lastError set.
 */
- (BOOL)activateAudioSession;

/**
 * Deactivates the active audio session with proper cleanup.
 * Thread-safe implementation that updates session state.
 *
 * @return YES if deactivation was successful, NO otherwise with lastError set.
 */
- (BOOL)deactivateAudioSession;

/**
 * Handles audio session interruptions with state restoration.
 * Thread-safe implementation that logs interruption history.
 *
 * @param notification The system notification containing interruption details.
 */
- (void)handleAudioSessionInterruption:(NSNotification *)notification;

/**
 * Handles audio route changes with automatic reconfiguration.
 * Thread-safe implementation that updates session state.
 *
 * @param notification The system notification containing route change details.
 */
- (void)handleAudioRouteChange:(NSNotification *)notification;

// Prevent direct instantiation
- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END