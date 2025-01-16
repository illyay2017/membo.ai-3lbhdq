//
//  RNVoiceModule.h
//  membo
//
//  Created for membo.ai voice recognition system
//  Version: 1.0
//

#import <React/React.h>  // React Native iOS SDK
#import <Foundation/Foundation.h>  // iOS SDK 12.0+
#import "Constants/VoiceConstants.h"
#import "Managers/VoiceManager.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * RNVoiceModule
 * React Native bridge module providing thread-safe voice recognition functionality
 * with enhanced error handling and resource management for voice-based study features.
 */
@interface RNVoiceModule : NSObject <RCTBridgeModule>

#pragma mark - Properties

/// Voice manager instance for handling recognition
@property (atomic, strong) VoiceManager *voiceManager;

/// Promise resolve block for async operations
@property (atomic, copy, nullable) RCTPromiseResolveBlock currentResolveBlock;

/// Promise reject block for async operations
@property (atomic, copy, nullable) RCTPromiseRejectBlock currentRejectBlock;

/// Lock for thread-safe operations
@property (atomic, strong) NSLock *operationLock;

/// Counter for automatic retry attempts
@property (atomic, assign) NSInteger retryCount;

#pragma mark - React Native Methods

/**
 * Starts voice recognition with automatic retry and error recovery.
 * Exposed to JavaScript as startVoiceRecognition.
 *
 * @param resolve Promise resolve block
 * @param reject Promise reject block
 */
RCT_EXTERN_METHOD(startVoiceRecognition:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Stops voice recognition with proper resource cleanup.
 * Exposed to JavaScript as stopVoiceRecognition.
 *
 * @param resolve Promise resolve block
 * @param reject Promise reject block
 */
RCT_EXTERN_METHOD(stopVoiceRecognition:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Checks if voice recognition is available.
 * Exposed to JavaScript as isVoiceRecognitionAvailable.
 *
 * @param resolve Promise resolve block
 * @param reject Promise reject block
 */
RCT_EXTERN_METHOD(isVoiceRecognitionAvailable:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Sets the recognition language.
 * Exposed to JavaScript as setRecognitionLanguage.
 *
 * @param languageCode BCP-47 language code
 * @param resolve Promise resolve block
 * @param reject Promise reject block
 */
RCT_EXTERN_METHOD(setRecognitionLanguage:(NSString *)languageCode
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

#pragma mark - Constants Export

/**
 * Exports constants to JavaScript for error handling and state management.
 * @return Dictionary of constants
 */
- (NSDictionary *)constantsToExport;

/**
 * Specifies the queue for running module methods.
 * @return Main queue for UI operations
 */
+ (BOOL)requiresMainQueueSetup;

@end

NS_ASSUME_NONNULL_END