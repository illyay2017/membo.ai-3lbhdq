//
//  VoiceManagerTests.m
//  memboTests
//
//  Created for membo.ai voice recognition testing
//  Version: 1.0
//  XCTest.framework version: iOS SDK 12.0+
//

#import <XCTest/XCTest.h>
#import "Managers/VoiceManager.h"
#import "Constants/VoiceConstants.h"

@interface VoiceManagerTests : XCTestCase

@property (nonatomic, strong) VoiceManager *voiceManager;
@property (nonatomic, strong) XCTestExpectation *recognitionExpectation;

@end

@implementation VoiceManagerTests

- (void)setUp {
    [super setUp];
    self.voiceManager = [VoiceManager sharedInstance];
    self.recognitionExpectation = [self expectationWithDescription:@"Voice Recognition"];
    
    // Reset manager state before each test
    [self.voiceManager stopVoiceRecognition];
    XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateIdle);
}

- (void)tearDown {
    // Cleanup after each test
    [self.voiceManager stopVoiceRecognition];
    [self waitForExpectationsWithTimeout:1.0 handler:nil];
    self.voiceManager = nil;
    self.recognitionExpectation = nil;
    [super tearDown];
}

- (void)testSharedInstance {
    // Test singleton implementation
    VoiceManager *firstInstance = [VoiceManager sharedInstance];
    VoiceManager *secondInstance = [VoiceManager sharedInstance];
    
    XCTAssertNotNil(firstInstance);
    XCTAssertNotNil(secondInstance);
    XCTAssertEqual(firstInstance, secondInstance);
}

- (void)testVoiceRecognitionAvailability {
    // Test availability checks
    BOOL isAvailable = [self.voiceManager isAvailable];
    
    if (isAvailable) {
        XCTAssertTrue([self.voiceManager isAvailable]);
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateIdle);
    } else {
        XCTAssertFalse([self.voiceManager isAvailable]);
        XCTAssertNotNil(self.voiceManager.lastError);
    }
}

- (void)testVoiceRecognitionStateTransitions {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    // Test initial state
    XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateIdle);
    
    // Test transition to listening state
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNil(error);
        [self.recognitionExpectation fulfill];
    }];
    
    XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateListening);
    
    // Test transition to processing state
    // Simulate voice input by waiting briefly
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateProcessing);
        
        // Test transition to finished state
        [self.voiceManager stopVoiceRecognition];
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateFinished);
    });
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

- (void)testVoiceRecognitionTimeout {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    XCTestExpectation *timeoutExpectation = [self expectationWithDescription:@"Timeout"];
    
    // Start recognition and wait for timeout
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNotNil(error);
        XCTAssertEqual(error.code, VoiceRecognitionErrorTimeout);
        [timeoutExpectation fulfill];
    }];
    
    // Wait longer than kVoiceRecognitionTimeout
    [self waitForExpectationsWithTimeout:kVoiceRecognitionTimeout + 1.0 handler:^(NSError * _Nullable error) {
        XCTAssertNil(error);
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateFinished);
    }];
}

- (void)testVoiceRecognitionResults {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    XCTestExpectation *resultExpectation = [self expectationWithDescription:@"Recognition Results"];
    
    // Test recognition with sample input
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNil(error);
        XCTAssertNotNil(result);
        
        if (result) {
            // Verify result meets accuracy threshold
            XCTAssertGreaterThanOrEqual(result.length, 1);
            [resultExpectation fulfill];
        }
    }];
    
    // Simulate voice input and wait for results
    [self waitForExpectationsWithTimeout:5.0 handler:^(NSError * _Nullable error) {
        XCTAssertNil(error);
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateFinished);
    }];
}

- (void)testVoiceRecognitionErrorHandling {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    XCTestExpectation *errorExpectation = [self expectationWithDescription:@"Error Handling"];
    
    // Test error handling with invalid configuration
    [self.voiceManager setRecognitionLanguage:@"invalid-language"];
    
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNotNil(error);
        XCTAssertEqual([self.voiceManager getCurrentState], VoiceRecognitionStateFinished);
        [errorExpectation fulfill];
    }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

- (void)testVoiceRecognitionLanguageSupport {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    // Test valid language setting
    XCTAssertTrue([self.voiceManager setRecognitionLanguage:@"en-US"]);
    
    // Test invalid language setting
    XCTAssertFalse([self.voiceManager setRecognitionLanguage:@"invalid-code"]);
}

- (void)testVoiceRecognitionConcurrency {
    if (![self.voiceManager isAvailable]) {
        XCTSkip(@"Voice recognition not available");
        return;
    }
    
    XCTestExpectation *concurrencyExpectation = [self expectationWithDescription:@"Concurrency"];
    
    // Start first recognition session
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNil(error);
    }];
    
    // Attempt to start second session while first is active
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        XCTAssertNotNil(error);
        [concurrencyExpectation fulfill];
    }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

@end