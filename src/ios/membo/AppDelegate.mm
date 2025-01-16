//
//  AppDelegate.mm
//  membo
//
//  Created by membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import "AppDelegate.h"
#import "Managers/VoiceManager.h"
#import "Managers/NotificationManager.h"

// React Native Core - v0.72.x
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTAppSetupUtils.h>

@interface AppDelegate ()

@property (atomic, assign) BOOL voiceInitialized;
@property (atomic, assign) BOOL notificationsConfigured;
@property (nonatomic, strong) dispatch_queue_t setupQueue;

@end

@implementation AppDelegate

#pragma mark - Lifecycle Methods

- (instancetype)init {
    self = [super init];
    if (self) {
        _voiceInitialized = NO;
        _notificationsConfigured = NO;
        _setupQueue = dispatch_queue_create("ai.membo.setup", DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

- (BOOL)application:(UIApplication *)application 
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    
    // Initialize React Native bridge with error handling
    @try {
        RCTAppSetupPrepareApp(application);
        
        self.bridge = [[RCTBridge alloc] initWithDelegate:self
                                          launchOptions:launchOptions];
        
        if (!self.bridge) {
            NSError *error = errorWithCode(MEMBO_ERROR_INTERNAL, 
                @{@"description": @"Failed to initialize React bridge"});
            NSLog(@"Bridge initialization failed: %@", error);
            return NO;
        }
        
        // Configure root view with safety checks
        RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:self.bridge
                                                        moduleName:@"membo"
                                                 initialProperties:nil];
        
        if (!rootView) {
            NSError *error = errorWithCode(MEMBO_ERROR_INTERNAL,
                @{@"description": @"Failed to create root view"});
            NSLog(@"Root view creation failed: %@", error);
            return NO;
        }
        
        // Configure window with thread safety
        dispatch_async(dispatch_get_main_queue(), ^{
            self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
            UIViewController *rootViewController = [UIViewController new];
            rootViewController.view = rootView;
            self.window.rootViewController = rootViewController;
            [self.window makeKeyAndVisible];
        });
        
        // Initialize voice processing on background queue
        dispatch_async(self.setupQueue, ^{
            [self initializeVoiceProcessing];
        });
        
        // Configure notifications with error handling
        dispatch_async(self.setupQueue, ^{
            [self configureNotifications];
        });
        
        return YES;
    }
    @catch (NSException *exception) {
        NSError *error = errorWithCode(MEMBO_ERROR_INTERNAL,
            @{@"description": exception.reason ?: @"Unknown launch error"});
        NSLog(@"Application launch failed: %@", error);
        return NO;
    }
}

#pragma mark - RCTBridgeDelegate Methods

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
    #if DEBUG
        return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
    #else
        return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    #endif
}

#pragma mark - Notification Handling

- (void)application:(UIApplication *)application 
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
    
    if (!deviceToken) {
        NSError *error = errorWithCode(MEMBO_ERROR_BAD_REQUEST,
            @{@"description": @"Invalid device token received"});
        NSLog(@"Device token registration failed: %@", error);
        return;
    }
    
    // Convert token to string safely
    NSString *tokenString = [self deviceTokenToString:deviceToken];
    
    // Update notification manager on main thread
    dispatch_async(dispatch_get_main_queue(), ^{
        [[MBNotificationManager sharedManager] handleDeviceToken:tokenString
            completionHandler:^(NSError * _Nullable error) {
                if (error) {
                    NSLog(@"Failed to process device token: %@", error);
                }
            }];
    });
}

#pragma mark - Private Methods

- (void)initializeVoiceProcessing {
    @try {
        VoiceManager *voiceManager = [VoiceManager sharedInstance];
        
        // Check voice recognition availability
        if (![voiceManager isAvailable]) {
            NSError *error = errorWithCode(MEMBO_ERROR_SERVICE_UNAVAILABLE,
                @{@"description": @"Voice recognition not available"});
            NSLog(@"Voice initialization failed: %@", error);
            return;
        }
        
        // Configure voice recognition
        [voiceManager setRecognitionLanguage:@"en-US"];
        [voiceManager setRecognitionTimeout:30.0];
        
        self.voiceInitialized = YES;
    }
    @catch (NSException *exception) {
        NSError *error = errorWithCode(MEMBO_ERROR_INTERNAL,
            @{@"description": exception.reason ?: @"Voice initialization failed"});
        NSLog(@"Voice setup error: %@", error);
    }
}

- (void)configureNotifications {
    @try {
        [[MBNotificationManager sharedManager] 
            requestNotificationPermissions:^(BOOL granted, NSError * _Nullable error) {
                if (error) {
                    NSLog(@"Notification permission error: %@", error);
                    return;
                }
                
                self.notificationsConfigured = granted;
                
                // Configure notification categories and actions
                if (granted) {
                    [self registerNotificationCategories];
                }
            }];
    }
    @catch (NSException *exception) {
        NSError *error = errorWithCode(MEMBO_ERROR_INTERNAL,
            @{@"description": exception.reason ?: @"Notification setup failed"});
        NSLog(@"Notification configuration error: %@", error);
    }
}

- (void)registerNotificationCategories {
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    
    // Study reminder category
    UNNotificationAction *startStudyAction = 
        [UNNotificationAction actionWithIdentifier:MBNotificationActionStartStudy
                                           title:@"Start Studying"
                                         options:UNNotificationActionOptionForeground];
    
    UNNotificationAction *snoozeAction =
        [UNNotificationAction actionWithIdentifier:MBNotificationActionSnooze
                                           title:@"Snooze"
                                         options:UNNotificationActionOptionNone];
    
    UNNotificationCategory *studyCategory =
        [UNNotificationCategory categoryWithIdentifier:MBNotificationCategoryStudyReminder
                                            actions:@[startStudyAction, snoozeAction]
                                  intentIdentifiers:@[]
                                            options:UNNotificationCategoryOptionNone];
    
    [center setNotificationCategories:[NSSet setWithObject:studyCategory]];
}

- (NSString *)deviceTokenToString:(NSData *)deviceToken {
    const unsigned char *tokenBytes = (const unsigned char *)[deviceToken bytes];
    NSMutableString *tokenString = [NSMutableString string];
    
    for (NSUInteger i = 0; i < [deviceToken length]; i++) {
        [tokenString appendFormat:@"%02.2hhX", tokenBytes[i]];
    }
    
    return [tokenString copy];
}

@end