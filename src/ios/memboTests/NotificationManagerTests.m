//
// NotificationManagerTests.m
// memboTests
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import <XCTest/XCTest.h>  // v12.0+
#import <UserNotifications/UserNotifications.h>  // v12.0+
#import "NotificationManager.h"
#import "ErrorCodes.h"

// Test constants
static NSTimeInterval const kTestTimeout = 5.0;
static NSString * const kTestNotificationCategory = @"com.membo.test.category";

@interface NotificationManagerTests : XCTestCase

@property (nonatomic, strong) MBNotificationManager *notificationManager;
@property (nonatomic, strong) UNUserNotificationCenter *notificationCenter;
@property (nonatomic, strong) dispatch_queue_t concurrentQueue;

@end

@implementation NotificationManagerTests

- (void)setUp {
    [super setUp];
    
    // Initialize test components
    self.notificationManager = [MBNotificationManager sharedManager];
    self.notificationCenter = [UNUserNotificationCenter currentNotificationCenter];
    self.concurrentQueue = dispatch_queue_create("com.membo.test.concurrent", DISPATCH_QUEUE_CONCURRENT);
    
    // Reset notification state
    [self.notificationManager cancelAllNotifications:nil];
    [[NSUserDefaults standardUserDefaults] removeSuiteNamed:@"notifications"];
}

- (void)tearDown {
    // Cleanup
    [self.notificationManager cancelAllNotifications:nil];
    self.notificationManager = nil;
    
    if (self.concurrentQueue) {
        self.concurrentQueue = nil;
    }
    
    [super tearDown];
}

#pragma mark - Singleton Tests

- (void)testSharedManagerSingleton {
    XCTestExpectation *expectation = [self expectationWithDescription:@"singleton test"];
    dispatch_group_t group = dispatch_group_create();
    
    __block NSMutableArray *instances = [NSMutableArray array];
    
    // Test concurrent access
    for (NSInteger i = 0; i < 10; i++) {
        dispatch_group_async(group, self.concurrentQueue, ^{
            MBNotificationManager *instance = [MBNotificationManager sharedManager];
            @synchronized (instances) {
                [instances addObject:instance];
            }
        });
    }
    
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{
        // Verify singleton consistency
        MBNotificationManager *firstInstance = instances.firstObject;
        for (MBNotificationManager *instance in instances) {
            XCTAssertEqual(firstInstance, instance, @"All instances should be identical");
        }
        [expectation fulfill];
    });
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

#pragma mark - Permission Tests

- (void)testRequestNotificationPermissions {
    XCTestExpectation *expectation = [self expectationWithDescription:@"permission request"];
    
    // Test successful permission grant
    [self.notificationManager requestNotificationPermissions:^(BOOL granted, NSError * _Nullable error) {
        XCTAssertTrue(granted, @"Permissions should be granted");
        XCTAssertNil(error, @"No error should occur");
        
        // Verify settings were cached
        [self.notificationManager getNotificationSettings:^(UNNotificationSettings *settings, NSError * _Nullable error) {
            XCTAssertEqual(settings.authorizationStatus, UNAuthorizationStatusAuthorized);
            [expectation fulfill];
        }];
    }];
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

- (void)testPermissionDeniedScenario {
    XCTestExpectation *expectation = [self expectationWithDescription:@"permission denied"];
    
    // Mock denied permission state
    id mockCenter = OCMPartialMock(self.notificationCenter);
    OCMStub([mockCenter requestAuthorizationWithOptions:UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound completionHandler:OCMOCK_ANY]).andDo(^(NSInvocation *invocation) {
        void(^completionHandler)(BOOL, NSError *);
        [invocation getArgument:&completionHandler atIndex:3];
        completionHandler(NO, nil);
    });
    
    [self.notificationManager requestNotificationPermissions:^(BOOL granted, NSError * _Nullable error) {
        XCTAssertFalse(granted, @"Permissions should be denied");
        XCTAssertNotNil(error, @"Error should be present");
        XCTAssertEqualObjects(error.domain, MEMBO_ERROR_DOMAIN);
        XCTAssertEqualObjects(error.userInfo[NSLocalizedDescriptionKey], @"Notification permissions denied");
        [expectation fulfill];
    }];
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

#pragma mark - Scheduling Tests

- (void)testScheduleStudyReminder {
    XCTestExpectation *expectation = [self expectationWithDescription:@"schedule reminder"];
    
    NSDate *reminderDate = [NSDate dateWithTimeIntervalSinceNow:3600];
    NSString *title = @"Study Time!";
    NSString *body = @"Time to review your flashcards";
    NSDictionary *userInfo = @{
        MBNotificationKeyStudySessionId: [[NSUUID UUID] UUIDString],
        MBNotificationKeyReminderId: @"test-reminder"
    };
    
    // Create test attachment
    NSURL *attachmentURL = [[NSBundle mainBundle] URLForResource:@"test_image" withExtension:@"png"];
    UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image"
                                                                                        URL:attachmentURL
                                                                                    options:nil
                                                                                      error:nil];
    
    [self.notificationManager scheduleStudyReminder:reminderDate
                                            title:title
                                             body:body
                                         userInfo:userInfo
                                      attachment:attachment
                               completionHandler:^(NSError * _Nullable error) {
        XCTAssertNil(error, @"No error should occur");
        
        // Verify scheduled notification
        [self.notificationCenter getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> * _Nonnull requests) {
            XCTAssertEqual(requests.count, 1, @"One notification should be scheduled");
            
            UNNotificationRequest *request = requests.firstObject;
            UNNotificationContent *content = request.content;
            
            XCTAssertEqualObjects(content.title, title);
            XCTAssertEqualObjects(content.body, body);
            XCTAssertEqualObjects(content.userInfo, userInfo);
            XCTAssertEqual(content.attachments.count, 1);
            
            [expectation fulfill];
        }];
    }];
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

#pragma mark - Settings Cache Tests

- (void)testNotificationSettingsCache {
    XCTestExpectation *expectation = [self expectationWithDescription:@"settings cache"];
    
    // First call should fetch from system
    [self.notificationManager getNotificationSettings:^(UNNotificationSettings *settings, NSError * _Nullable error) {
        XCTAssertNotNil(settings);
        XCTAssertNil(error);
        
        // Second call should use cache
        [self.notificationManager getNotificationSettings:^(UNNotificationSettings *cachedSettings, NSError * _Nullable cacheError) {
            XCTAssertEqualObjects(settings, cachedSettings);
            
            // Force cache invalidation
            [[NSNotificationCenter defaultCenter] postNotificationName:UIApplicationDidBecomeActiveNotification
                                                            object:nil];
            
            // Third call should fetch fresh settings
            [self.notificationManager getNotificationSettings:^(UNNotificationSettings *freshSettings, NSError * _Nullable freshError) {
                XCTAssertNotNil(freshSettings);
                [expectation fulfill];
            }];
        }];
    }];
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

#pragma mark - Thread Safety Tests

- (void)testConcurrentNotificationOperations {
    XCTestExpectation *expectation = [self expectationWithDescription:@"concurrent operations"];
    dispatch_group_t group = dispatch_group_create();
    
    // Schedule multiple notifications concurrently
    for (NSInteger i = 0; i < 5; i++) {
        dispatch_group_async(group, self.concurrentQueue, ^{
            NSDate *date = [NSDate dateWithTimeIntervalSinceNow:3600 + i];
            [self.notificationManager scheduleStudyReminder:date
                                                    title:[NSString stringWithFormat:@"Reminder %ld", (long)i]
                                                     body:@"Study time!"
                                                 userInfo:nil
                                              attachment:nil
                                       completionHandler:nil];
        });
    }
    
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{
        [self.notificationCenter getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> * _Nonnull requests) {
            XCTAssertEqual(requests.count, 5, @"All notifications should be scheduled");
            [expectation fulfill];
        }];
    });
    
    [self waitForExpectationsWithTimeout:kTestTimeout handler:nil];
}

@end