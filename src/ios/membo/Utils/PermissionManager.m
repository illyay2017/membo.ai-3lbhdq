//
//  PermissionManager.m
//  membo
//
//  Created by membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import "PermissionManager.h"

// Constants
NSString * const MBPermissionErrorDomain = @"ai.membo.permission";
static NSString * const kMicrophonePermissionKey = @"MBMicrophonePermissionGranted";
static NSString * const kNotificationPermissionKey = @"MBNotificationPermissionGranted";

// Error codes
typedef NS_ENUM(NSInteger, MBPermissionError) {
    MBPermissionErrorUnknown = -1,
    MBPermissionErrorDenied = 100,
    MBPermissionErrorRestricted = 101,
    MBPermissionErrorSystemFailure = 102
};

// Singleton instance and synchronization
static PermissionManager *sharedInstance = nil;
static dispatch_once_t onceToken;
static dispatch_queue_t permissionQueue;

@interface PermissionManager ()
@property (nonatomic, assign) BOOL microphonePermissionGranted;
@property (nonatomic, assign) BOOL notificationPermissionGranted;
@property (nonatomic, strong) NSError *lastError;
@property (nonatomic, strong) NSUserDefaults *defaults;
@end

@implementation PermissionManager

#pragma mark - Lifecycle

+ (instancetype)sharedInstance {
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] initPrivate];
        permissionQueue = dispatch_queue_create("ai.membo.permissionQueue", DISPATCH_QUEUE_SERIAL);
    });
    return sharedInstance;
}

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _defaults = [NSUserDefaults standardUserDefaults];
        
        // Restore saved permission states
        _microphonePermissionGranted = [_defaults boolForKey:kMicrophonePermissionKey];
        _notificationPermissionGranted = [_defaults boolForKey:kNotificationPermissionKey];
        
        // Register for permission change notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleAudioSessionInterruption:)
                                                   name:AVAudioSessionInterruptionNotification
                                                 object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - Permission Requests

- (void)requestMicrophonePermission:(MBPermissionCompletionHandler)completion {
    dispatch_async(permissionQueue, ^{
        AVAudioSession *audioSession = [AVAudioSession sharedInstance];
        
        switch ([audioSession recordPermission]) {
            case AVAudioSessionRecordPermissionGranted:
                [self updateMicrophonePermissionState:YES];
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(YES, nil);
                });
                break;
                
            case AVAudioSessionRecordPermissionDenied: {
                NSError *error = [NSError errorWithDomain:MBPermissionErrorDomain
                                                   code:MBPermissionErrorDenied
                                               userInfo:@{NSLocalizedDescriptionKey: @"Microphone access denied"}];
                [self updateMicrophonePermissionState:NO];
                self.lastError = error;
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(NO, error);
                });
                break;
            }
                
            case AVAudioSessionRecordPermissionUndetermined:
                [audioSession requestRecordPermission:^(BOOL granted) {
                    [self updateMicrophonePermissionState:granted];
                    NSError *error = nil;
                    if (!granted) {
                        error = [NSError errorWithDomain:MBPermissionErrorDomain
                                                  code:MBPermissionErrorDenied
                                              userInfo:@{NSLocalizedDescriptionKey: @"Microphone access denied"}];
                        self.lastError = error;
                    }
                    dispatch_async(dispatch_get_main_queue(), ^{
                        completion(granted, error);
                    });
                }];
                break;
        }
    });
}

- (void)requestNotificationPermission:(MBPermissionCompletionHandler)completion {
    dispatch_async(permissionQueue, ^{
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
        UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge;
        
        [center requestAuthorizationWithOptions:options completionHandler:^(BOOL granted, NSError * _Nullable error) {
            [self updateNotificationPermissionState:granted];
            if (error) {
                self.lastError = error;
            } else if (!granted) {
                error = [NSError errorWithDomain:MBPermissionErrorDomain
                                          code:MBPermissionErrorDenied
                                      userInfo:@{NSLocalizedDescriptionKey: @"Notification permission denied"}];
                self.lastError = error;
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                completion(granted, error);
            });
        }];
    });
}

#pragma mark - Permission Checks

- (BOOL)checkMicrophonePermission {
    __block BOOL permission = NO;
    dispatch_sync(permissionQueue, ^{
        AVAudioSession *audioSession = [AVAudioSession sharedInstance];
        permission = [audioSession recordPermission] == AVAudioSessionRecordPermissionGranted;
        [self updateMicrophonePermissionState:permission];
    });
    return permission;
}

- (BOOL)checkNotificationPermission {
    __block BOOL permission = NO;
    dispatch_sync(permissionQueue, ^{
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        
        [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
            permission = settings.authorizationStatus == UNAuthorizationStatusAuthorized;
            [self updateNotificationPermissionState:permission];
            dispatch_semaphore_signal(semaphore);
        }];
        
        dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    });
    return permission;
}

#pragma mark - Private Methods

- (void)updateMicrophonePermissionState:(BOOL)granted {
    self.microphonePermissionGranted = granted;
    [self.defaults setBool:granted forKey:kMicrophonePermissionKey];
    [self.defaults synchronize];
    
    [[NSNotificationCenter defaultCenter] postNotificationName:@"MBMicrophonePermissionChanged"
                                                      object:self
                                                    userInfo:@{@"granted": @(granted)}];
}

- (void)updateNotificationPermissionState:(BOOL)granted {
    self.notificationPermissionGranted = granted;
    [self.defaults setBool:granted forKey:kNotificationPermissionKey];
    [self.defaults synchronize];
    
    [[NSNotificationCenter defaultCenter] postNotificationName:@"MBNotificationPermissionChanged"
                                                      object:self
                                                    userInfo:@{@"granted": @(granted)}];
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    NSInteger type = [notification.userInfo[AVAudioSessionInterruptionTypeKey] integerValue];
    if (type == AVAudioSessionInterruptionTypeBegan) {
        [self checkMicrophonePermission];
    }
}

@end