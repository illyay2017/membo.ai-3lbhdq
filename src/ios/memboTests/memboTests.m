//
//  memboTests.m
//  memboTests
//
//  Created for membo.ai iOS test suite
//  Version: 1.0
//

#import <XCTest/XCTest.h>  // iOS SDK 12.0+
#import "AppDelegate.h"
#import "Utils/AudioSessionManager.h"

@interface MemboTests : XCTestCase

@property (nonatomic, strong) AppDelegate *appDelegate;
@property (nonatomic, strong) AudioSessionManager *audioManager;
@property (nonatomic, strong) XCTestExpectation *bridgeLoadExpectation;
@property (nonatomic, strong) XCTestExpectation *audioConfigExpectation;

@end

@implementation MemboTests

- (void)setUp {
    [super setUp];
    
    // Initialize app delegate
    self.appDelegate = [[AppDelegate alloc] init];
    XCTAssertNotNil(self.appDelegate, @"App delegate should be initialized");
    
    // Get audio manager instance
    self.audioManager = [AudioSessionManager sharedInstance];
    XCTAssertNotNil(self.audioManager, @"Audio manager should be initialized");
    
    // Set up async expectations
    self.bridgeLoadExpectation = [self expectationWithDescription:@"Bridge Load"];
    self.audioConfigExpectation = [self expectationWithDescription:@"Audio Config"];
    
    // Register for notifications
    [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleBridgeDidLoad:)
                                               name:RCTJavaScriptDidLoadNotification
                                             object:nil];
    
    [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleAudioSessionInterruption:)
                                               name:AVAudioSessionInterruptionNotification
                                             object:nil];
}

- (void)tearDown {
    // Remove notification observers
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    
    // Cleanup audio session
    XCTAssertTrue([self.audioManager deactivateAudioSession], @"Audio session should deactivate");
    
    // Reset properties
    self.appDelegate = nil;
    self.audioManager = nil;
    self.bridgeLoadExpectation = nil;
    self.audioConfigExpectation = nil;
    
    [super tearDown];
}

#pragma mark - App Initialization Tests

- (void)testAppInitialization {
    // Test window initialization
    XCTAssertNotNil(self.appDelegate.window, @"Window should be created");
    XCTAssertTrue(self.appDelegate.window.isKeyWindow, @"Window should be key window");
    
    // Test bridge initialization
    XCTAssertNotNil(self.appDelegate.bridge, @"Bridge should be initialized");
    
    // Test bridge URL
    NSURL *bundleURL = [self.appDelegate sourceURLForBridge:self.appDelegate.bridge];
    XCTAssertNotNil(bundleURL, @"Bundle URL should be valid");
    
    // Wait for bridge load with timeout
    [self waitForExpectationsWithTimeout:10.0 handler:^(NSError *error) {
        XCTAssertNil(error, @"Bridge should load without error");
    }];
}

#pragma mark - Audio Session Tests

- (void)testAudioSessionConfiguration {
    // Test initial configuration
    XCTAssertTrue([self.audioManager configureAudioSession], @"Audio session should configure");
    
    // Verify session category
    AVAudioSession *session = self.audioManager.audioSession;
    XCTAssertNotNil(session, @"Audio session should exist");
    
    NSError *error = nil;
    AVAudioSessionCategory category = [session category];
    XCTAssertEqual(category, AVAudioSessionCategoryPlayAndRecord, @"Category should be play and record");
    
    // Test activation
    XCTAssertTrue([self.audioManager activateAudioSession], @"Audio session should activate");
    XCTAssertTrue(self.audioManager.isAudioSessionActive, @"Session should be marked active");
    
    // Verify audio settings
    double sampleRate = [session sampleRate];
    XCTAssertEqual(sampleRate, kAudioSampleRate, @"Sample rate should match constant");
    
    NSInteger channels = [session inputNumberOfChannels];
    XCTAssertEqual(channels, kAudioChannels, @"Channel count should match constant");
}

- (void)testAudioInterruptionHandling {
    // Configure and activate session
    XCTAssertTrue([self.audioManager configureAudioSession], @"Session should configure");
    XCTAssertTrue([self.audioManager activateAudioSession], @"Session should activate");
    
    // Simulate interruption begin
    NSDictionary *beginInfo = @{
        AVAudioSessionInterruptionTypeKey: @(AVAudioSessionInterruptionTypeBegan)
    };
    NSNotification *beginNotification = [NSNotification notificationWithName:AVAudioSessionInterruptionNotification
                                                                    object:nil
                                                                  userInfo:beginInfo];
    [self.audioManager handleAudioSessionInterruption:beginNotification];
    
    XCTAssertFalse(self.audioManager.isAudioSessionActive, @"Session should be inactive after interruption");
    
    // Simulate interruption end
    NSDictionary *endInfo = @{
        AVAudioSessionInterruptionTypeKey: @(AVAudioSessionInterruptionTypeEnded),
        AVAudioSessionInterruptionOptionKey: @(AVAudioSessionInterruptionOptionShouldResume)
    };
    NSNotification *endNotification = [NSNotification notificationWithName:AVAudioSessionInterruptionNotification
                                                                  object:nil
                                                                userInfo:endInfo];
    [self.audioManager handleAudioSessionInterruption:endNotification];
    
    XCTAssertTrue(self.audioManager.isAudioSessionActive, @"Session should reactivate after interruption");
    
    // Verify interruption history
    XCTAssertEqual(self.audioManager.interruptionHistory.count, 2, @"Should record both interruption events");
}

#pragma mark - Notification Handlers

- (void)handleBridgeDidLoad:(NSNotification *)notification {
    [self.bridgeLoadExpectation fulfill];
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    [self.audioConfigExpectation fulfill];
}

@end