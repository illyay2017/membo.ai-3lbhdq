//
// NotificationManager.h
// membo
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import <Foundation/Foundation.h>              // Foundation v17.0+
#import <UserNotifications/UserNotifications.h>  // UserNotifications v12.0+
#import "ErrorCodes.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * MBNotificationManager
 * Singleton manager class handling all notification-related functionality for the membo.ai iOS app.
 * Implements enhanced error handling, privacy features, and study reminder scheduling.
 */
@interface MBNotificationManager : NSObject <UNUserNotificationCenterDelegate>

#pragma mark - Properties

/// The shared notification center instance
@property (nonatomic, strong, readonly) UNUserNotificationCenter *notificationCenter;

/// Device token for remote notifications
@property (nonatomic, copy, nullable) NSString *deviceToken;

/// Current notification permission status
@property (nonatomic, assign, readonly) BOOL isNotificationsEnabled;

/// Cached notification settings
@property (nonatomic, strong, readonly) NSUserDefaults *notificationSettings;

/// Serial queue for thread-safe notification operations
@property (nonatomic, strong, readonly) dispatch_queue_t notificationQueue;

/// Cache of pending notifications
@property (nonatomic, strong, readonly) NSMutableDictionary *pendingNotifications;

#pragma mark - Singleton Access

/**
 * Returns the shared notification manager instance.
 * Thread-safe singleton implementation.
 *
 * @return The shared MBNotificationManager instance
 */
+ (instancetype)sharedManager;

#pragma mark - Initialization

/**
 * Unavailable initializer - use sharedManager instead.
 */
- (instancetype)init NS_UNAVAILABLE;

/**
 * Unavailable initializer - use sharedManager instead.
 */
+ (instancetype)new NS_UNAVAILABLE;

#pragma mark - Permission Management

/**
 * Requests notification permissions from the user with enhanced error handling.
 * Requests authorization for alerts, badges, and sounds.
 *
 * @param completionHandler Block called with permission result and any error
 */
- (void)requestNotificationPermissions:(void (^)(BOOL granted, NSError * _Nullable error))completionHandler;

#pragma mark - Notification Scheduling

/**
 * Schedules a study reminder notification with rich content support.
 * Validates inputs and handles errors appropriately.
 *
 * @param date Scheduled notification delivery date
 * @param title Notification title
 * @param body Notification body text
 * @param userInfo Optional dictionary of custom data
 * @param attachment Optional media attachment
 * @param completionHandler Block called with any error that occurred
 */
- (void)scheduleStudyReminder:(NSDate *)date
                       title:(NSString *)title
                        body:(NSString *)body
                    userInfo:(nullable NSDictionary *)userInfo
                 attachment:(nullable UNNotificationAttachment *)attachment
          completionHandler:(void (^)(NSError * _Nullable error))completionHandler;

/**
 * Cancels all pending notifications and cleans up resources.
 *
 * @param completionHandler Block called with any error that occurred
 */
- (void)cancelAllNotifications:(nullable void (^)(NSError * _Nullable error))completionHandler;

#pragma mark - Settings Management

/**
 * Retrieves current notification settings with caching support.
 *
 * @param completionHandler Block called with current settings and any error
 */
- (void)getNotificationSettings:(void (^)(UNNotificationSettings *settings, 
                                        NSError * _Nullable error))completionHandler;

@end

#pragma mark - Constants

/// Notification category identifiers
extern NSString * const MBNotificationCategoryStudyReminder;
extern NSString * const MBNotificationCategorySystemAlert;

/// Notification action identifiers
extern NSString * const MBNotificationActionStartStudy;
extern NSString * const MBNotificationActionSnooze;
extern NSString * const MBNotificationActionDismiss;

/// Notification user info keys
extern NSString * const MBNotificationKeyContentId;
extern NSString * const MBNotificationKeyStudySessionId;
extern NSString * const MBNotificationKeyReminderId;

/// Default values
extern const NSTimeInterval MBNotificationDefaultSnoozeInterval;
extern const NSUInteger MBNotificationMaxPendingReminders;

NS_ASSUME_NONNULL_END