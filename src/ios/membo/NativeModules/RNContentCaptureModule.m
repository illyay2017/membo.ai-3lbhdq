//
//  RNContentCaptureModule.m
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import "RNContentCaptureModule.h"

// Error domain for content capture operations
NSString *const RNContentCaptureErrorDomain = @"ai.membo.ContentCapture";

// Serial queue for thread-safe capture operations
static dispatch_queue_t _captureQueue;

@implementation RNContentCaptureModule {
    ContentCaptureManager *_contentCaptureManager;
}

#pragma mark - Lifecycle

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_MODULE(RNContentCapture)

- (instancetype)init {
    if (self = [super init]) {
        // Create serial queue for capture operations
        _captureQueue = dispatch_queue_create("ai.membo.ContentCapture", DISPATCH_QUEUE_SERIAL);
        
        // Get shared manager instance
        _contentCaptureManager = [ContentCaptureManager sharedInstance];
        
        // Register for memory warnings
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    if (_captureQueue) {
        _captureQueue = nil;
    }
    _contentCaptureManager = nil;
}

#pragma mark - Memory Management

- (void)handleMemoryWarning {
    // Clean up temporary resources on memory warning
    dispatch_async(_captureQueue, ^{
        [self->_contentCaptureManager.fileManager cleanupTemporaryFiles:3600 completion:^(NSUInteger count, NSError * _Nullable error) {
            if (error) {
                NSLog(@"Error cleaning up temporary files: %@", error);
            }
        }];
    });
}

#pragma mark - Content Capture Methods

RCT_EXPORT_METHOD(captureWebContent:(NSDictionary *)content
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Validate input parameters
    if (!content || ![content isKindOfClass:[NSDictionary class]]) {
        NSError *error = errorWithCode(MEMBO_ERROR_BAD_REQUEST, @{
            @"detail": @"Invalid content format"
        });
        reject(@"BAD_REQUEST", error.localizedDescription, error);
        return;
    }
    
    NSString *text = content[@"text"];
    NSString *sourceUrl = content[@"sourceUrl"];
    
    if (!text.length || !sourceUrl.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"detail": @"Missing required content fields"
        });
        reject(@"VALIDATION_ERROR", error.localizedDescription, error);
        return;
    }
    
    // Dispatch capture operation to serial queue
    dispatch_async(_captureQueue, ^{
        [self->_contentCaptureManager captureWebContent:text
                                            sourceUrl:sourceUrl
                                          completion:^(BOOL success, NSError * _Nullable error) {
            if (success) {
                resolve(@{@"success": @YES});
            } else {
                reject(@"CAPTURE_ERROR", error.localizedDescription, error);
            }
        }];
    });
}

RCT_EXPORT_METHOD(capturePDFContent:(NSString *)base64Data
                  fileName:(NSString *)fileName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Validate input parameters
    if (!base64Data.length || !fileName.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"detail": @"Missing PDF data or filename"
        });
        reject(@"VALIDATION_ERROR", error.localizedDescription, error);
        return;
    }
    
    // Convert base64 to data
    NSData *pdfData = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
    if (!pdfData) {
        NSError *error = errorWithCode(MEMBO_ERROR_BAD_REQUEST, @{
            @"detail": @"Invalid PDF data format"
        });
        reject(@"BAD_REQUEST", error.localizedDescription, error);
        return;
    }
    
    // Dispatch PDF processing to serial queue
    dispatch_async(_captureQueue, ^{
        [self->_contentCaptureManager capturePDFContent:pdfData
                                            fileName:fileName
                                          completion:^(BOOL success, NSError * _Nullable error) {
            if (success) {
                resolve(@{@"success": @YES});
            } else {
                reject(@"PDF_ERROR", error.localizedDescription, error);
            }
        }];
    });
}

RCT_EXPORT_METHOD(captureKindleContent:(NSArray *)highlights
                  bookTitle:(NSString *)bookTitle
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Validate input parameters
    if (!highlights || ![highlights isKindOfClass:[NSArray class]] || !highlights.count) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"detail": @"Invalid highlights data"
        });
        reject(@"VALIDATION_ERROR", error.localizedDescription, error);
        return;
    }
    
    if (!bookTitle.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"detail": @"Missing book title"
        });
        reject(@"VALIDATION_ERROR", error.localizedDescription, error);
        return;
    }
    
    // Dispatch Kindle processing to serial queue
    dispatch_async(_captureQueue, ^{
        [self->_contentCaptureManager captureKindleContent:highlights
                                              bookTitle:bookTitle
                                            completion:^(BOOL success, NSError * _Nullable error) {
            if (success) {
                resolve(@{@"success": @YES});
            } else {
                reject(@"KINDLE_ERROR", error.localizedDescription, error);
            }
        }];
    });
}

RCT_EXPORT_METHOD(syncContent:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Dispatch sync operation to serial queue
    dispatch_async(_captureQueue, ^{
        [self->_contentCaptureManager syncContent:^(BOOL success, NSError * _Nullable error) {
            if (success) {
                resolve(@{@"success": @YES});
            } else {
                reject(@"SYNC_ERROR", error.localizedDescription, error);
            }
        }];
    });
}

@end