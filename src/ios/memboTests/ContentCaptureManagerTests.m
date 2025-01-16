//
//  ContentCaptureManagerTests.m
//  memboTests
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import <XCTest/XCTest.h>
#import "ContentCaptureManager.h"
#import "FileManager.h"

@interface ContentCaptureManagerTests : XCTestCase

@property (nonatomic, strong) ContentCaptureManager *contentCaptureManager;
@property (nonatomic, strong) FileManager *mockFileManager;
@property (nonatomic, strong) dispatch_queue_t testQueue;
@property (nonatomic, strong) XCTestExpectation *asyncExpectation;

@end

@implementation ContentCaptureManagerTests

- (void)setUp {
    [super setUp];
    
    // Initialize test queue
    self.testQueue = dispatch_queue_create("ai.membo.tests.content", DISPATCH_QUEUE_SERIAL);
    
    // Create mock FileManager
    self.mockFileManager = [[FileManager alloc] init];
    
    // Get singleton instance
    self.contentCaptureManager = [ContentCaptureManager sharedInstance];
    
    // Reset state
    self.asyncExpectation = nil;
}

- (void)tearDown {
    // Clean up resources
    self.contentCaptureManager = nil;
    self.mockFileManager = nil;
    self.asyncExpectation = nil;
    self.testQueue = nil;
    
    [super tearDown];
}

- (void)testCaptureWebContent {
    // Set up test data
    NSString *testContent = @"Test web content";
    NSString *testUrl = @"https://example.com/article";
    
    self.asyncExpectation = [self expectationWithDescription:@"Web content capture"];
    
    // Test successful capture
    [self.contentCaptureManager captureWebContent:testContent 
                                      sourceUrl:testUrl
                                    completion:^(BOOL success, NSError *error) {
        XCTAssertTrue(success);
        XCTAssertNil(error);
        [self.asyncExpectation fulfill];
    }];
    
    // Test concurrent captures
    dispatch_async(self.testQueue, ^{
        [self.contentCaptureManager captureWebContent:@"Concurrent content"
                                          sourceUrl:@"https://example.com/other"
                                        completion:nil];
    });
    
    // Test error handling with invalid input
    [self.contentCaptureManager captureWebContent:@""
                                      sourceUrl:@""
                                    completion:^(BOOL success, NSError *error) {
        XCTAssertFalse(success);
        XCTAssertNotNil(error);
        XCTAssertEqual(error.domain, kContentCaptureErrorDomain);
    }];
    
    [self waitForExpectationsWithTimeout:5.0 handler:nil];
}

- (void)testCapturePDFContent {
    // Set up test data
    NSData *testPdfData = [@"PDF test data" dataUsingEncoding:NSUTF8StringEncoding];
    NSString *testFileName = @"test.pdf";
    
    self.asyncExpectation = [self expectationWithDescription:@"PDF content capture"];
    
    // Test successful capture
    [self.contentCaptureManager capturePDFContent:testPdfData
                                       fileName:testFileName
                                    completion:^(BOOL success, NSError *error) {
        XCTAssertTrue(success);
        XCTAssertNil(error);
        [self.asyncExpectation fulfill];
    }];
    
    // Test invalid PDF data
    NSData *invalidData = [@"Invalid PDF" dataUsingEncoding:NSUTF8StringEncoding];
    [self.contentCaptureManager capturePDFContent:invalidData
                                       fileName:@"invalid.pdf"
                                    completion:^(BOOL success, NSError *error) {
        XCTAssertFalse(success);
        XCTAssertNotNil(error);
        XCTAssertEqual(error.domain, kContentCaptureErrorDomain);
    }];
    
    [self waitForExpectationsWithTimeout:5.0 handler:nil];
}

- (void)testCaptureKindleContent {
    // Set up test data
    NSArray *testHighlights = @[
        @{@"text": @"Test highlight 1", @"location": @"100"},
        @{@"text": @"Test highlight 2", @"location": @"200"}
    ];
    NSString *testBookTitle = @"Test Book";
    
    self.asyncExpectation = [self expectationWithDescription:@"Kindle content capture"];
    
    // Test successful capture
    [self.contentCaptureManager captureKindleContent:testHighlights
                                         bookTitle:testBookTitle
                                       completion:^(BOOL success, NSError *error) {
        XCTAssertTrue(success);
        XCTAssertNil(error);
        [self.asyncExpectation fulfill];
    }];
    
    // Test empty highlights
    [self.contentCaptureManager captureKindleContent:@[]
                                         bookTitle:testBookTitle
                                       completion:^(BOOL success, NSError *error) {
        XCTAssertFalse(success);
        XCTAssertNotNil(error);
        XCTAssertEqual(error.domain, kContentCaptureErrorDomain);
    }];
    
    [self waitForExpectationsWithTimeout:5.0 handler:nil];
}

- (void)testSyncContent {
    self.asyncExpectation = [self expectationWithDescription:@"Content sync"];
    
    // Test successful sync
    [self.contentCaptureManager syncContent:^(BOOL success, NSError *error) {
        XCTAssertTrue(success);
        XCTAssertNil(error);
        [self.asyncExpectation fulfill];
    }];
    
    // Test offline handling
    dispatch_async(self.testQueue, ^{
        [self.contentCaptureManager syncContent:^(BOOL success, NSError *error) {
            XCTAssertFalse(success);
            XCTAssertNotNil(error);
            XCTAssertEqual(error.domain, MEMBO_ERROR_NETWORK);
        }];
    });
    
    // Test retry mechanism
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), self.testQueue, ^{
        [self.contentCaptureManager syncContent:^(BOOL success, NSError *error) {
            XCTAssertTrue(success);
            XCTAssertNil(error);
        }];
    });
    
    [self waitForExpectationsWithTimeout:5.0 handler:nil];
}

- (void)testThreadSafety {
    // Test concurrent operations
    dispatch_group_t group = dispatch_group_create();
    dispatch_queue_t concurrentQueue = dispatch_queue_create("ai.membo.tests.concurrent", DISPATCH_QUEUE_CONCURRENT);
    
    for (int i = 0; i < 100; i++) {
        dispatch_group_enter(group);
        dispatch_async(concurrentQueue, ^{
            [self.contentCaptureManager captureWebContent:[NSString stringWithFormat:@"Content %d", i]
                                              sourceUrl:@"https://example.com"
                                            completion:^(BOOL success, NSError *error) {
                dispatch_group_leave(group);
            }];
        });
    }
    
    XCTAssertEqual(dispatch_group_wait(group, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(10 * NSEC_PER_SEC))), 0);
}

- (void)testErrorHandling {
    // Test network error
    NSError *networkError = errorWithCode(MEMBO_ERROR_NETWORK, nil);
    XCTAssertNotNil(networkError);
    XCTAssertEqual(networkError.domain, MEMBO_ERROR_DOMAIN);
    
    // Test validation error
    NSError *validationError = errorWithCode(MEMBO_ERROR_VALIDATION, nil);
    XCTAssertNotNil(validationError);
    XCTAssertEqual(validationError.domain, MEMBO_ERROR_DOMAIN);
    
    // Test timeout error
    NSError *timeoutError = errorWithCode(MEMBO_ERROR_TIMEOUT, nil);
    XCTAssertNotNil(timeoutError);
    XCTAssertEqual(timeoutError.domain, MEMBO_ERROR_DOMAIN);
}

@end