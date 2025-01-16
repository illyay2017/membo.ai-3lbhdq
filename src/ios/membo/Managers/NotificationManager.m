//
// NotificationManager.m
// membo
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import "NotificationManager.h"

#pragma mark - Constants

NSString * const MBNotificationCategoryStudyReminder = @"com.membo.notification.category.studyreminder";
NSString * const MBNotificationCategorySystemAlert = @"com.membo.notification.category.systemalert";

NSString * const MBNotificationActionStartStudy = @"com.membo.notification.action.startstudy";
NSString * const MBNotificationActionSnooze = @"com.membo.notification.action.snooze";
NSString * const MBNotificationActionDismiss = @"com.membo.notification.action.dismiss";

NSString * const MBNotificationKeyContentId = @"contentId";
NSString * const MBNotificationKeyStudySessionId = @"studySessionId";
NSString * const MBNotificationKeyReminderId = @"reminderId";

const NSTimeInterval MBNotificationDefaultSnoozeInterval = 900.0; // 15 minutes
const NSUInteger MBNotificationMaxPendingReminders = 64;

#pragma mark - Private Interface

@interface MBNotificationManager ()

@property (nonatomic, strong) UNUserNotificationCenter *notificationCenter;
@property (nonatomic, assign) BOOL isNotificationsEnabled;
@property (nonatomic, strong) dispatch_queue_t notificationQueue;
@property (nonatomic, strong) NSCache *settingsCache;
@property (nonatomic, strong) NSMutableDictionary *pendingNotifications;

@end

#pragma mark - Implementation

@implementation MBNotificationManager

#pragma mark - Singleton

static MBNotificationManager *sharedInstance = nil;
static dispatch_once_t onceToken;

+ (instancetype)sharedManager {
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] initPrivate];
    });
    return sharedInstance;
}

#pragma mark - Initialization

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _notificationCenter = [UNUserNotificationCenter currentNotificationCenter];
        _notificationCenter.delegate = self;
        _isNotificationsEnabled = NO;
        _notificationQueue = dispatch_queue_create("com.membo.notification.queue", DISPATCH_QUEUE_SERIAL);
        _settingsCache = [[NSCache alloc] init];
        _settingsCache.countLimit = 1;
        _pendingNotifications = [NSMutableDictionary dictionary];
        
        [self registerNotificationCategories];
        [self checkInitialNotificationSettings];
    }
    return self;
}

- (instancetype)init {
    @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                 reason:@"Must use sharedManager instead"
                               userInfo:nil];
}

#pragma mark - Permission Management

- (void)requestNotificationPermissions:(void (^)(BOOL granted, NSError * _Nullable error))completionHandler {
    if (!completionHandler) {
        return;
    }
    
    UNAuthorizationOptions options = UNAuthorizationOptionAlert |
                                   UNAuthorizationOptionBadge |
                                   UNAuthorizationOptionSound;
    
    dispatch_async(self.notificationQueue, ^{
        [self.notificationCenter requestAuthorizationWithOptions:options
                                            completionHandler:^(BOOL granted, NSError * _Nullable error) {
            if (error) {
                NSError *wrappedError = [self errorWithCode:MEMBO_ERROR_NOTIFICATION_FAILED
                                                 userInfo:@{
                    NSUnderlyingErrorKey: error,
                    NSLocalizedDescriptionKey: @"Failed to request notification permissions"
                }];
                dispatch_async(dispatch_get_main_queue(), ^{
                    completionHandler(NO, wrappedError);
                });
                return;
            }
            
            self.isNotificationsEnabled = granted;
            dispatch_async(dispatch_get_main_queue(), ^{
                completionHandler(granted, nil);
            });
        }];
    });
}

#pragma mark - Notification Scheduling

- (void)scheduleStudyReminder:(NSDate *)date
                       title:(NSString *)title
                        body:(NSString *)body
                    userInfo:(nullable NSDictionary *)userInfo
                 attachment:(nullable UNNotificationAttachment *)attachment
          completionHandler:(void (^)(NSError * _Nullable))completionHandler {
    
    if (!completionHandler) {
        return;
    }
    
    if (!date || !title || !body) {
        NSError *error = [self errorWithCode:MEMBO_ERROR_BAD_REQUEST
                                  userInfo:@{
            NSLocalizedDescriptionKey: @"Invalid notification parameters"
        }];
        dispatch_async(dispatch_get_main_queue(), ^{
            completionHandler(error);
        });
        return;
    }
    
    dispatch_async(self.notificationQueue, ^{
        // Check if we've hit the maximum pending notifications
        if (self.pendingNotifications.count >= MBNotificationMaxPendingReminders) {
            NSError *error = [self errorWithCode:MEMBO_ERROR_NOTIFICATION_FAILED
                                      userInfo:@{
                NSLocalizedDescriptionKey: @"Maximum pending notifications reached"
            }];
            dispatch_async(dispatch_get_main_queue(), ^{
                completionHandler(error);
            });
            return;
        }
        
        // Create notification content
        UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
        content.title = title;
        content.body = body;
        content.sound = [UNNotificationSound defaultSound];
        content.categoryIdentifier = MBNotificationCategoryStudyReminder;
        
        if (userInfo) {
            content.userInfo = userInfo;
        }
        
        if (attachment) {
            content.attachments = @[attachment];
        }
        
        // Create trigger
        NSCalendar *calendar = [NSCalendar currentCalendar];
        NSDateComponents *components = [calendar components:(NSCalendarUnitYear |
                                                          NSCalendarUnitMonth |
                                                          NSCalendarUnitDay |
                                                          NSCalendarUnitHour |
                                                          NSCalendarUnitMinute |
                                                          NSCalendarUnitSecond)
                                                 fromDate:date];
        
        UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger
                                                 triggerWithDateMatchingComponents:components
                                                 repeats:NO];
        
        // Create request
        NSString *identifier = [[NSUUID UUID] UUIDString];
        UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier
                                                                          content:content
                                                                          trigger:trigger];
        
        // Add to notification center
        [self.notificationCenter addNotificationRequest:request
                                   completionHandler:^(NSError * _Nullable error) {
            if (error) {
                NSError *wrappedError = [self errorWithCode:MEMBO_ERROR_NOTIFICATION_FAILED
                                                 userInfo:@{
                    NSUnderlyingErrorKey: error,
                    NSLocalizedDescriptionKey: @"Failed to schedule notification"
                }];
                dispatch_async(dispatch_get_main_queue(), ^{
                    completionHandler(wrappedError);
                });
                return;
            }
            
            // Track pending notification
            self.pendingNotifications[identifier] = request;
            
            dispatch_async(dispatch_get_main_queue(), ^{
                completionHandler(nil);
            });
        }];
    });
}

#pragma mark - Private Helpers

- (void)registerNotificationCategories {
    UNNotificationAction *startStudyAction = [UNNotificationAction
                                            actionWithIdentifier:MBNotificationActionStartStudy
                                            title:@"Start Studying"
                                            options:UNNotificationActionOptionForeground];
    
    UNNotificationAction *snoozeAction = [UNNotificationAction
                                        actionWithIdentifier:MBNotificationActionSnooze
                                        title:@"Snooze"
                                        options:UNNotificationActionOptionNone];
    
    UNNotificationAction *dismissAction = [UNNotificationAction
                                         actionWithIdentifier:MBNotificationActionDismiss
                                         title:@"Dismiss"
                                         options:UNNotificationActionOptionDestructive];
    
    UNNotificationCategory *studyCategory = [UNNotificationCategory
                                           categoryWithIdentifier:MBNotificationCategoryStudyReminder
                                           actions:@[startStudyAction, snoozeAction, dismissAction]
                                           intentIdentifiers:@[]
                                           options:UNNotificationCategoryOptionNone];
    
    [self.notificationCenter setNotificationCategories:[NSSet setWithObject:studyCategory]];
}

- (void)checkInitialNotificationSettings {
    dispatch_async(self.notificationQueue, ^{
        [self.notificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
            self.isNotificationsEnabled = (settings.authorizationStatus == UNAuthorizationStatusAuthorized);
        }];
    });
}

- (NSError *)errorWithCode:(NSString *)code userInfo:(NSDictionary *)userInfo {
    NSMutableDictionary *errorInfo = [NSMutableDictionary dictionaryWithDictionary:userInfo];
    errorInfo[NSLocalizedFailureReasonErrorKey] = code;
    return [NSError errorWithDomain:MEMBO_ERROR_DOMAIN
                             code:-1
                         userInfo:errorInfo];
}

#pragma mark - UNUserNotificationCenterDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    completionHandler(UNNotificationPresentationOptionBanner |
                     UNNotificationPresentationOptionSound |
                     UNNotificationPresentationOptionBadge);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
    
    NSString *identifier = response.notification.request.identifier;
    [self.pendingNotifications removeObjectForKey:identifier];
    
    if ([response.actionIdentifier isEqualToString:MBNotificationActionSnooze]) {
        // Reschedule notification with snooze interval
        UNNotificationRequest *originalRequest = response.notification.request;
        NSDate *newDate = [NSDate dateWithTimeIntervalSinceNow:MBNotificationDefaultSnoozeInterval];
        
        [self scheduleStudyReminder:newDate
                            title:originalRequest.content.title
                             body:originalRequest.content.body
                         userInfo:originalRequest.content.userInfo
                      attachment:originalRequest.content.attachments.firstObject
               completionHandler:^(NSError * _Nullable error) {
            if (error) {
                NSLog(@"Failed to snooze notification: %@", error);
            }
        }];
    }
    
    completionHandler();
}

@end