//
//  StudyManagerTests.m
//  memboTests
//
//  Comprehensive test suite for StudyManager functionality including
//  thread safety, FSRS algorithm, and voice-enabled study features.
//

@import XCTest;  // iOS SDK 12.0+
#import "Managers/StudyManager.h"
#import "Constants/StudyModes.h"
#import "Utils/AudioSessionManager.h"

@interface StudyManagerTests : XCTestCase <MBStudyManagerDelegate>

@property (nonatomic, strong) StudyManager *studyManager;
@property (nonatomic, strong) MBStudyModeConfig testConfig;
@property (nonatomic, strong) NSOperationQueue *testQueue;
@property (nonatomic, strong) NSArray<NSString *> *testCards;
@property (nonatomic, strong) XCTestExpectation *asyncExpectation;
@property (nonatomic, strong) NSMutableDictionary *sessionResults;

@end

@implementation StudyManagerTests

#pragma mark - Test Lifecycle

- (void)setUp {
    [super setUp];
    
    // Initialize StudyManager instance
    self.studyManager = [StudyManager sharedInstance];
    self.studyManager.delegate = self;
    
    // Configure test study mode settings
    self.testConfig = (MBStudyModeConfig){
        .sessionDuration = 3600,
        .allowVoiceInput = YES,
        .showConfidenceButtons = YES,
        .enableFSRS = YES,
        .minCardsPerSession = MB_MIN_CARDS_PER_SESSION,
        .maxCardsPerSession = 50,
        .voiceConfidenceThreshold = MB_DEFAULT_VOICE_CONFIDENCE_THRESHOLD,
        .enableAutoAdvance = NO,
        .cardDisplayDuration = 0,
        .enableHapticFeedback = YES
    };
    
    // Initialize test queue for concurrent operations
    self.testQueue = [[NSOperationQueue alloc] init];
    self.testQueue.maxConcurrentOperationCount = 4;
    
    // Setup test cards
    self.testCards = @[@"card1", @"card2", @"card3", @"card4", @"card5"];
    
    // Initialize session results tracking
    self.sessionResults = [NSMutableDictionary dictionary];
}

- (void)tearDown {
    // End any active study session
    if (self.studyManager.isSessionActive) {
        [self.studyManager endStudySession];
    }
    
    // Cancel and clear test operations
    [self.testQueue cancelAllOperations];
    self.testQueue = nil;
    
    // Clear test data
    self.testCards = nil;
    self.sessionResults = nil;
    self.asyncExpectation = nil;
    self.studyManager.delegate = nil;
    self.studyManager = nil;
    
    [super tearDown];
}

#pragma mark - Study Session Tests

- (void)testStudySessionLifecycle {
    // Test basic session start/end
    XCTAssertTrue([self.studyManager startStudySession:MBStudyModeStandard 
                                              config:&_testConfig],
                  @"Study session should start successfully");
    
    XCTAssertTrue(self.studyManager.isSessionActive, @"Session should be active");
    XCTAssertEqual(self.studyManager.currentMode, MBStudyModeStandard);
    
    [self.studyManager endStudySession];
    XCTAssertFalse(self.studyManager.isSessionActive, @"Session should be inactive");
}

- (void)testVoiceModeConfiguration {
    // Test voice mode initialization
    self.testConfig.allowVoiceInput = YES;
    XCTAssertTrue([self.studyManager startStudySession:MBStudyModeVoice 
                                              config:&_testConfig],
                  @"Voice mode session should start successfully");
    
    XCTAssertEqual(self.studyManager.currentMode, MBStudyModeVoice);
    XCTAssertTrue(self.studyManager.currentConfig.allowVoiceInput);
    
    // Test voice input processing
    XCTAssertTrue([self.studyManager processCardResponse:4 
                                            voiceInput:@"Test answer"],
                  @"Voice input should be processed");
}

#pragma mark - FSRS Algorithm Tests

- (void)testFSRSAlgorithmAccuracy {
    self.asyncExpectation = [self expectationWithDescription:@"FSRS Test"];
    
    // Start session with FSRS enabled
    self.testConfig.enableFSRS = YES;
    XCTAssertTrue([self.studyManager startStudySession:MBStudyModeStandard 
                                              config:&_testConfig]);
    
    // Process multiple responses to test scheduling
    NSArray *confidenceLevels = @[@4, @3, @5, @2, @4];
    NSInteger cardIndex = 0;
    
    for (NSNumber *confidence in confidenceLevels) {
        XCTAssertTrue([self.studyManager processCardResponse:confidence.integerValue 
                                                voiceInput:nil],
                      @"Card response should be processed");
        cardIndex++;
    }
    
    // Verify FSRS calculations
    NSDictionary *stats = self.studyManager.sessionStats;
    XCTAssertNotNil(stats[@"retentionRate"]);
    XCTAssertGreaterThanOrEqual([stats[@"retentionRate"] floatValue], 0.85);
    
    [self waitForExpectationsWithTimeout:5.0 handler:nil];
}

#pragma mark - Thread Safety Tests

- (void)testConcurrentStudySessions {
    self.asyncExpectation = [self expectationWithDescription:@"Concurrent Operations"];
    
    // Create multiple concurrent operations
    for (NSInteger i = 0; i < 10; i++) {
        [self.testQueue addOperationWithBlock:^{
            // Start and end sessions rapidly
            XCTAssertTrue([self.studyManager startStudySession:MBStudyModeStandard 
                                                      config:&self->_testConfig]);
            
            [self.studyManager processCardResponse:4 voiceInput:nil];
            [self.studyManager endStudySession];
        }];
    }
    
    // Wait for all operations to complete
    [self.testQueue addOperationWithBlock:^{
        [self.asyncExpectation fulfill];
    }];
    
    [self waitForExpectationsWithTimeout:10.0 handler:nil];
}

#pragma mark - Performance Tests

- (void)testStudySessionPerformance {
    [self measureBlock:^{
        // Measure session initialization performance
        XCTAssertTrue([self.studyManager startStudySession:MBStudyModeStandard 
                                                  config:&self->_testConfig]);
        
        // Process multiple cards rapidly
        for (NSInteger i = 0; i < 20; i++) {
            [self.studyManager processCardResponse:4 voiceInput:nil];
        }
        
        [self.studyManager endStudySession];
    }];
}

#pragma mark - Error Handling Tests

- (void)testInvalidConfigurations {
    // Test invalid session duration
    MBStudyModeConfig invalidConfig = self.testConfig;
    invalidConfig.sessionDuration = 0;
    
    XCTAssertFalse([self.studyManager startStudySession:MBStudyModeStandard 
                                               config:&invalidConfig],
                   @"Session should not start with invalid duration");
    
    // Test invalid card limits
    invalidConfig = self.testConfig;
    invalidConfig.minCardsPerSession = 0;
    
    XCTAssertFalse([self.studyManager startStudySession:MBStudyModeStandard 
                                               config:&invalidConfig],
                   @"Session should not start with invalid card limits");
}

#pragma mark - MBStudyManagerDelegate

- (void)didStartStudySession:(MBStudyMode)mode config:(MBStudyModeConfig *)config {
    self.sessionResults[@"sessionStarted"] = @YES;
}

- (void)didCompleteStudySession:(NSDictionary<NSString *,NSNumber *> *)stats {
    self.sessionResults[@"sessionCompleted"] = @YES;
    self.sessionResults[@"stats"] = stats;
    
    if (self.asyncExpectation) {
        [self.asyncExpectation fulfill];
    }
}

- (void)didReceiveVoiceInput:(NSString *)input confidence:(CGFloat)confidence {
    self.sessionResults[@"voiceInput"] = input;
    self.sessionResults[@"voiceConfidence"] = @(confidence);
}

@end