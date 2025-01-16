//
//  VoiceManager.h
//  membo
//
//  Created for membo.ai voice recognition system
//  Version: 1.0
//  Foundation.framework version: iOS SDK 12.0+
//

#import <Foundation/Foundation.h>  // iOS SDK 12.0+
#import <Speech/Speech.h>         // iOS SDK 12.0+
#import <AVFoundation/AVFoundation.h>  // iOS SDK 12.0+
#import "Constants/VoiceConstants.h"
#import "Utils/AudioSessionManager.h"
#import "Utils/PermissionManager.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * VoiceManager
 * Thread-safe singleton class managing voice recognition and audio processing
 * for voice-based study features with comprehensive error handling and resource management.
 */
@interface VoiceManager : NSObject

#pragma mark - Properties

/// Speech recognizer instance for voice processing
@property (atomic, strong, readonly) SFSpeechRecognizer *speechRecognizer;

/// Audio engine for voice capture
@property (atomic, strong, readonly) AVAudioEngine *audioEngine;

/// Current recognition task
@property (atomic, strong, readonly, nullable) SFSpeechRecognitionTask *recognitionTask;

/// Current state of voice recognition
@property (atomic, assign, readonly) VoiceRecognitionState currentState;

/// Most recent error encountered
@property (atomic, strong, readonly, nullable) NSError *lastError;

/// Flag indicating if recognition is in progress
@property (atomic, assign, readonly) BOOL isProcessing;

/// Current recognition language
@property (atomic, strong, readonly) NSString *currentLanguage;

#pragma mark - Singleton Access

/**
 * Returns the shared singleton instance of VoiceManager.
 * Thread-safe implementation using GCD dispatch_once.
 *
 * @return The shared VoiceManager instance.
 */
+ (instancetype)sharedInstance NS_SWIFT_NAME(shared);

#pragma mark - Voice Recognition Control

/**
 * Initiates voice recognition session with completion callback.
 * Handles permissions, audio session setup, and error conditions.
 *
 * @param completion Handler called with recognition result or error.
 */
- (void)startVoiceRecognition:(void (^)(NSString * _Nullable result, 
                                      NSError * _Nullable error))completion
    NS_SWIFT_NAME(startVoiceRecognition(completion:));

/**
 * Safely stops ongoing voice recognition session.
 * Performs proper resource cleanup and state management.
 */
- (void)stopVoiceRecognition NS_SWIFT_NAME(stopVoiceRecognition());

#pragma mark - State Management

/**
 * Returns current voice recognition state.
 * Thread-safe implementation.
 *
 * @return Current VoiceRecognitionState.
 */
- (VoiceRecognitionState)getCurrentState NS_SWIFT_NAME(getCurrentState());

/**
 * Checks if voice recognition is available.
 * Verifies permissions, hardware availability, and system support.
 *
 * @return YES if voice recognition is available, NO otherwise.
 */
- (BOOL)isAvailable NS_SWIFT_NAME(isAvailable());

#pragma mark - Configuration

/**
 * Sets the recognition language.
 * Updates speech recognizer configuration if needed.
 *
 * @param languageCode BCP-47 language code (e.g., "en-US").
 * @return YES if language was set successfully, NO otherwise.
 */
- (BOOL)setRecognitionLanguage:(NSString *)languageCode
    NS_SWIFT_NAME(setRecognitionLanguage(_:));

/**
 * Configures recognition timeout duration.
 * Must be called before starting recognition.
 *
 * @param timeout Duration in seconds before recognition times out.
 */
- (void)setRecognitionTimeout:(NSTimeInterval)timeout
    NS_SWIFT_NAME(setRecognitionTimeout(_:));

#pragma mark - Unavailable Initializers

/// Prevent direct instantiation to enforce singleton pattern
+ (instancetype)new NS_UNAVAILABLE;
- (instancetype)init NS_UNAVAILABLE;

@end

#pragma mark - Notification Names

/// Posted when voice recognition state changes
extern NSNotificationName const MBVoiceRecognitionStateDidChangeNotification;

/// Posted when voice recognition encounters an error
extern NSNotificationName const MBVoiceRecognitionErrorNotification;

#pragma mark - Error Domain

/// Error domain for voice recognition errors
extern NSString * const MBVoiceRecognitionErrorDomain;

#pragma mark - Userinfo Keys

/// Key for accessing the new state in state change notifications
extern NSString * const MBVoiceRecognitionNewStateKey;

/// Key for accessing the previous state in state change notifications
extern NSString * const MBVoiceRecognitionPreviousStateKey;

NS_ASSUME_NONNULL_END