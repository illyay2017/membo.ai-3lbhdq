//
//  VoiceConstants.h
//  membo
//
//  Created for membo.ai voice recognition system
//  Version: 1.0
//  Foundation.framework version: iOS SDK 12.0+
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - Audio Configuration Constants

/// Standard audio sample rate for voice recording in Hz
extern NSInteger const kAudioSampleRate;

/// Mono channel recording for voice optimization
extern NSInteger const kAudioChannels;

/// Standard bit depth for voice recording quality
extern NSInteger const kAudioBitDepth;

/// Maximum duration in seconds before recognition times out
extern NSTimeInterval const kVoiceRecognitionTimeout;

/// Audio buffer size in bytes for processing voice data
extern NSInteger const kVoiceBufferSize;

/// Maximum allowed duration in seconds for voice recording
extern NSTimeInterval const kMaxRecordingDuration;

#pragma mark - Voice Recognition State Enumeration

/**
 * Defines the possible states of the voice recognition process.
 * Used to manage the lifecycle of voice input handling.
 */
typedef NS_ENUM(NSInteger, VoiceRecognitionState) {
    /// Initial state when no voice recognition is active
    VoiceRecognitionStateIdle = 0,
    
    /// Actively listening for user voice input
    VoiceRecognitionStateListening,
    
    /// Processing captured voice data
    VoiceRecognitionStateProcessing,
    
    /// Voice recognition process completed
    VoiceRecognitionStateFinished
};

#pragma mark - Voice Recognition Error Enumeration

/**
 * Defines possible error types that can occur during voice recognition.
 * Used for error handling and providing appropriate user feedback.
 */
typedef NS_ENUM(NSInteger, VoiceRecognitionError) {
    /// Microphone permission not granted
    VoiceRecognitionErrorNoPermission = 1000,
    
    /// Voice recognition service not available
    VoiceRecognitionErrorNotAvailable,
    
    /// Recognition process timed out
    VoiceRecognitionErrorTimeout,
    
    /// Audio session configuration error
    VoiceRecognitionErrorAudioSession,
    
    /// Unspecified recognition error
    VoiceRecognitionErrorUnknown
};

NS_ASSUME_NONNULL_END