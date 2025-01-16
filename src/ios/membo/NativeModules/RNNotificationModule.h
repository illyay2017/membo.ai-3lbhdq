//
// RNNotificationModule.h
// membo
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import <React/RCTBridgeModule.h>  // React Native v0.72.0+
#import <Foundation/Foundation.h>   // Foundation v17.0+
#import <UserNotifications/UserNotifications.h>  // UserNotifications v12.0+
#import "NotificationManager.h"
#import "ErrorCodes.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * RNNotificationModule
 * React Native bridge module for iOS notifications with comprehensive error handling
 * and analytics support for the membo.ai spaced repetition system.
 */
@interface RNNotificationModule : NSObject <RCTBridgeModule, UNUserNotificationCenterDelegate>

#pragma mark - Properties

/// Core notification manager instance
@property (nonatomic, strong) MBNotificationManager *notificationManager;

/// Serial queue for thread-safe notification operations
@property (nonatomic, strong) dispatch_queue_t notificationQueue;

#pragma mark - React Native Methods

/**
 * Requests notification permissions from the user.
 * Exposed to JavaScript as `requestPermissions`.
 *
 * @param options Dictionary containing permission options (alert, badge, sound)
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(requestPermissions:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Schedules a study reminder notification.
 * Exposed to JavaScript as `scheduleStudyReminder`.
 *
 * @param options Dictionary containing reminder configuration
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(scheduleStudyReminder:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Cancels all pending notifications.
 * Exposed to JavaScript as `cancelAllNotifications`.
 *
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(cancelAllNotifications:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Retrieves current notification settings.
 * Exposed to JavaScript as `getNotificationSettings`.
 *
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXTERN_METHOD(getNotificationSettings:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

#pragma mark - Required RCTBridgeModule Method

/**
 * Required method for React Native modules.
 * Specifies the queue on which native module methods should be run.
 */
+ (BOOL)requiresMainQueueSetup;

@end

NS_ASSUME_NONNULL_END