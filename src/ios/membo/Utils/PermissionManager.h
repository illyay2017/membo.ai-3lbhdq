//
//  PermissionManager.h
//  membo
//
//  Created by membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <UserNotifications/UserNotifications.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Completion handler type for permission request operations.
 * @param granted Whether the permission was granted
 * @param error Optional error if the request failed
 */
typedef void (^MBPermissionCompletionHandler)(BOOL granted, NSError * _Nullable error);

/**
 * Error domain for permission-related errors
 */
extern NSString * const MBPermissionErrorDomain;

/**
 * Thread-safe singleton class managing iOS system permissions for microphone and notifications
 * with comprehensive error handling and state persistence.
 */
NS_SWIFT_NAME(PermissionManager)
API_AVAILABLE(ios(12.0))
@interface PermissionManager : NSObject

/**
 * Returns the singleton instance using GCD dispatch_once for thread safety
 */
@property (class, nonatomic, readonly, strong) PermissionManager *sharedInstance NS_SWIFT_NAME(shared);

/**
 * Current microphone permission status
 */
@property (atomic, readonly, assign) BOOL microphonePermissionGranted;

/**
 * Current notification permission status
 */
@property (atomic, readonly, assign) BOOL notificationPermissionGranted;

/**
 * Most recent error encountered during permission operations
 */
@property (atomic, readonly, nullable) NSError *lastError;

/**
 * Asynchronously requests microphone permission
 * @param completion Handler called with the result of the permission request
 */
- (void)requestMicrophonePermission:(MBPermissionCompletionHandler)completion
    NS_SWIFT_NAME(requestMicrophonePermission(completion:));

/**
 * Asynchronously requests notification permission
 * @param completion Handler called with the result of the permission request
 */
- (void)requestNotificationPermission:(MBPermissionCompletionHandler)completion
    NS_SWIFT_NAME(requestNotificationPermission(completion:));

/**
 * Synchronously checks current microphone permission status
 * @return Current microphone permission status
 */
- (BOOL)checkMicrophonePermission NS_SWIFT_NAME(checkMicrophonePermission());

/**
 * Synchronously checks current notification permission status
 * @return Current notification permission status
 */
- (BOOL)checkNotificationPermission NS_SWIFT_NAME(checkNotificationPermission());

/**
 * Unavailable initializers to enforce singleton pattern
 */
+ (instancetype)new NS_UNAVAILABLE;
- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END