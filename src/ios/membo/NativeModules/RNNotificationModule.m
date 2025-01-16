//
// RNNotificationModule.m
// membo
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import "RNNotificationModule.h"

@implementation RNNotificationModule {
    MBNotificationManager *_notificationManager;
    dispatch_queue_t _notificationQueue;
    NSMutableDictionary *_pendingNotifications;
}

#pragma mark - Lifecycle

- (instancetype)init {
    if (self = [super init]) {
        _notificationManager = [MBNotificationManager sharedManager];
        _notificationQueue = dispatch_queue_create("ai.membo.notification.queue", DISPATCH_QUEUE_SERIAL);
        _pendingNotifications = [NSMutableDictionary new];
        
        // Register for app lifecycle notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(applicationWillEnterForeground:)
                                                   name:UIApplicationWillEnterForegroundNotification
                                                 object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - RCTBridgeModule Implementation

+ (NSString *)moduleName {
    return @"RNNotificationModule";
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

#pragma mark - Public Methods

RCT_EXPORT_METHOD(requestPermissions:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_notificationQueue, ^{
        [self->_notificationManager requestNotificationPermissions:^(BOOL granted, NSError * _Nullable error) {
            if (error) {
                reject(MEMBO_ERROR_BAD_REQUEST, 
                      localizedMessageForErrorCode(MEMBO_ERROR_BAD_REQUEST, nil),
                      error);
                return;
            }
            
            [self->_notificationManager getNotificationSettings:^(UNNotificationSettings *settings, NSError * _Nullable settingsError) {
                if (settingsError) {
                    reject(MEMBO_ERROR_INTERNAL,
                          localizedMessageForErrorCode(MEMBO_ERROR_INTERNAL, nil),
                          settingsError);
                    return;
                }
                
                NSDictionary *result = @{
                    @"granted": @(granted),
                    @"alert": @(settings.alertSetting == UNNotificationSettingEnabled),
                    @"badge": @(settings.badgeSetting == UNNotificationSettingEnabled),
                    @"sound": @(settings.soundSetting == UNNotificationSettingEnabled),
                    @"criticalAlert": @(settings.criticalAlertSetting == UNNotificationSettingEnabled),
                    @"provisional": @(settings.providesAppNotificationSettings),
                    @"lockScreen": @(settings.lockScreenSetting == UNNotificationSettingEnabled),
                    @"notificationCenter": @(settings.notificationCenterSetting == UNNotificationSettingEnabled)
                };
                
                resolve(result);
            }];
        }];
    });
}

RCT_EXPORT_METHOD(scheduleStudyReminder:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    if (!options[@"date"] || !options[@"title"] || !options[@"body"]) {
        reject(MEMBO_ERROR_VALIDATION,
               localizedMessageForErrorCode(MEMBO_ERROR_VALIDATION, nil),
               nil);
        return;
    }
    
    NSDate *date = [NSDate dateWithTimeIntervalSince1970:[options[@"date"] doubleValue]];
    NSString *title = options[@"title"];
    NSString *body = options[@"body"];
    NSDictionary *userInfo = options[@"userInfo"];
    
    dispatch_async(_notificationQueue, ^{
        UNNotificationAttachment *attachment = nil;
        if (options[@"attachmentUrl"]) {
            NSURL *attachmentURL = [NSURL URLWithString:options[@"attachmentUrl"]];
            NSError *attachmentError = nil;
            attachment = [UNNotificationAttachment attachmentWithIdentifier:[[NSUUID UUID] UUIDString]
                                                                     URL:attachmentURL
                                                                 options:nil
                                                                   error:&attachmentError];
            if (attachmentError) {
                NSLog(@"Failed to create attachment: %@", attachmentError);
            }
        }
        
        [self->_notificationManager scheduleStudyReminder:date
                                                  title:title
                                                   body:body
                                               userInfo:userInfo
                                            attachment:attachment
                                     completionHandler:^(NSError * _Nullable error) {
            if (error) {
                reject(MEMBO_ERROR_INTERNAL,
                      localizedMessageForErrorCode(MEMBO_ERROR_INTERNAL, nil),
                      error);
                return;
            }
            
            NSString *identifier = [[NSUUID UUID] UUIDString];
            self->_pendingNotifications[identifier] = @{
                @"date": @([date timeIntervalSince1970]),
                @"title": title,
                @"body": body,
                @"userInfo": userInfo ?: @{}
            };
            
            resolve(@{@"id": identifier});
        }];
    });
}

RCT_EXPORT_METHOD(cancelAllNotifications:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_notificationQueue, ^{
        [self->_notificationManager cancelAllNotifications:^(NSError * _Nullable error) {
            if (error) {
                reject(MEMBO_ERROR_INTERNAL,
                      localizedMessageForErrorCode(MEMBO_ERROR_INTERNAL, nil),
                      error);
                return;
            }
            
            [self->_pendingNotifications removeAllObjects];
            resolve(@{@"success": @YES});
        }];
    });
}

RCT_EXPORT_METHOD(getNotificationSettings:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_notificationQueue, ^{
        [self->_notificationManager getNotificationSettings:^(UNNotificationSettings *settings, NSError * _Nullable error) {
            if (error) {
                reject(MEMBO_ERROR_INTERNAL,
                      localizedMessageForErrorCode(MEMBO_ERROR_INTERNAL, nil),
                      error);
                return;
            }
            
            NSDictionary *result = @{
                @"authorizationStatus": @(settings.authorizationStatus),
                @"alertSetting": @(settings.alertSetting),
                @"badgeSetting": @(settings.badgeSetting),
                @"soundSetting": @(settings.soundSetting),
                @"criticalAlertSetting": @(settings.criticalAlertSetting),
                @"notificationCenterSetting": @(settings.notificationCenterSetting),
                @"lockScreenSetting": @(settings.lockScreenSetting),
                @"carPlaySetting": @(settings.carPlaySetting),
                @"alertStyle": @(settings.alertStyle),
                @"scheduledNotificationsCount": @(self->_pendingNotifications.count),
                @"showPreviewsSetting": @(settings.showPreviewsSetting)
            };
            
            resolve(result);
        }];
    });
}

#pragma mark - Private Methods

- (void)applicationWillEnterForeground:(NSNotification *)notification {
    dispatch_async(_notificationQueue, ^{
        // Clean up expired notifications
        NSMutableArray *expiredIds = [NSMutableArray new];
        NSDate *now = [NSDate date];
        
        [self->_pendingNotifications enumerateKeysAndObjectsUsingBlock:^(NSString *identifier, NSDictionary *notificationInfo, BOOL *stop) {
            NSDate *scheduledDate = [NSDate dateWithTimeIntervalSince1970:[notificationInfo[@"date"] doubleValue]];
            if ([scheduledDate compare:now] == NSOrderedAscending) {
                [expiredIds addObject:identifier];
            }
        }];
        
        [expiredIds enumerateObjectsUsingBlock:^(NSString *identifier, NSUInteger idx, BOOL *stop) {
            [self->_pendingNotifications removeObjectForKey:identifier];
        }];
    });
}

@end