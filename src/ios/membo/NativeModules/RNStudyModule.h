//
//  RNStudyModule.h
//  membo
//
//  React Native bridge module for study functionality with enhanced
//  voice capabilities and performance tracking.
//  React version: 0.72.x
//  Foundation.framework version: iOS SDK 12.0+
//

#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>
#import "Managers/StudyManager.h"
#import "Constants/StudyModes.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * React Native bridge module for study functionality with enhanced
 * voice recognition and performance tracking capabilities.
 */
@interface RNStudyModule : NSObject <RCTBridgeModule, MBStudyManagerDelegate>

#pragma mark - Properties

/// Shared instance of StudyManager for session management
@property (nonatomic, strong) StudyManager *studyManager;

/// Dedicated queue for thread-safe study operations
@property (nonatomic, strong) dispatch_queue_t processingQueue;

#pragma mark - React Native Methods

/**
 * Starts a new study session with specified mode and configuration.
 * Supports voice-enabled learning and performance tracking.
 *
 * @param config Dictionary containing session configuration
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(startStudySession:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

/**
 * Submits user response for current card with voice input processing.
 *
 * @param confidence User confidence rating (1-5)
 * @param voiceInput Optional voice input string
 * @param voiceConfidence Voice recognition confidence level
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(submitCardResponse:(NSInteger)confidence
                  voiceInput:(nullable NSString *)voiceInput
                  voiceConfidence:(float)voiceConfidence
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

/**
 * Ends the current study session and processes results.
 *
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(endStudySession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

#pragma mark - Required RCTBridgeModule Methods

/**
 * Returns the name for the native module when registered with React Native.
 */
+ (NSString *)moduleName;

/**
 * Specifies if the module should be initialized on the main thread.
 */
+ (BOOL)requiresMainQueueSetup;

@end

NS_ASSUME_NONNULL_END