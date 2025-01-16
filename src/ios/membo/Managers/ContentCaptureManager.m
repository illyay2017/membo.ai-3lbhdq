//
//  ContentCaptureManager.m
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import "ContentCaptureManager.h"

// Error domain constant
NSString *const kContentCaptureErrorDomain = @"ai.membo.ContentCapture";

// Private interface
@interface ContentCaptureManager ()

@property (nonatomic, strong) FileManager *fileManager;
@property (nonatomic, strong) NSError *lastError;
@property (nonatomic, strong) NSOperationQueue *syncQueue;
@property (nonatomic, strong) NSMutableDictionary *pendingOperations;
@property (nonatomic, assign) NSInteger retryCount;

@end

// Static variables
static ContentCaptureManager *sharedManager = nil;
static const NSTimeInterval kSyncTimeout = 30.0;
static const NSInteger kMaxRetryAttempts = 3;

@implementation ContentCaptureManager

#pragma mark - Lifecycle

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[self alloc] initPrivate];
    });
    return sharedManager;
}

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _fileManager = [FileManager sharedInstance];
        _syncQueue = [[NSOperationQueue alloc] init];
        _syncQueue.maxConcurrentOperationCount = 1;
        _pendingOperations = [NSMutableDictionary new];
        _retryCount = 0;
        
        // Register for memory warning notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - Web Content Capture

- (void)captureWebContent:(NSString *)content
                sourceUrl:(NSString *)sourceUrl
              completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    
    if (!content.length || !sourceUrl.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"message": @"Content and source URL are required"
        });
        if (completion) completion(NO, error);
        return;
    }
    
    NSString *fileName = [[NSUUID UUID] UUIDString];
    NSData *contentData = [content dataUsingEncoding:NSUTF8StringEncoding];
    
    NSDictionary *metadata = @{
        @"type": @"web",
        @"source": sourceUrl,
        @"timestamp": @([[NSDate date] timeIntervalSince1970]),
        @"size": @(contentData.length)
    };
    
    [self.fileManager saveContent:contentData
                       fileName:fileName
                    completion:^(BOOL success, NSError * _Nullable error) {
        if (success) {
            self.pendingOperations[fileName] = metadata;
            [self triggerSyncIfNeeded];
            if (completion) completion(YES, nil);
        } else {
            self.lastError = error;
            if (completion) completion(NO, error);
        }
    }];
}

#pragma mark - PDF Content Capture

- (void)capturePDFContent:(NSData *)pdfData
                fileName:(NSString *)fileName
              completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    
    if (!pdfData.length || !fileName.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"message": @"PDF data and filename are required"
        });
        if (completion) completion(NO, error);
        return;
    }
    
    CGPDFDocumentRef pdfDocument = CGPDFDocumentCreateWithData((__bridge CFDataRef)pdfData);
    if (!pdfDocument) {
        NSError *error = errorWithCode(MEMBO_ERROR_BAD_REQUEST, @{
            @"message": @"Invalid PDF document"
        });
        if (completion) completion(NO, error);
        return;
    }
    
    size_t pageCount = CGPDFDocumentGetNumberOfPages(pdfDocument);
    NSMutableString *extractedText = [NSMutableString string];
    
    // Extract text from PDF (simplified implementation)
    for (size_t i = 1; i <= pageCount; i++) {
        CGPDFPageRef page = CGPDFDocumentGetPage(pdfDocument, i);
        if (page) {
            // Text extraction would go here
            // This is a simplified version
        }
    }
    
    CGPDFDocumentRelease(pdfDocument);
    
    NSDictionary *metadata = @{
        @"type": @"pdf",
        @"filename": fileName,
        @"pageCount": @(pageCount),
        @"timestamp": @([[NSDate date] timeIntervalSince1970]),
        @"size": @(pdfData.length)
    };
    
    [self.fileManager saveContent:pdfData
                       fileName:fileName
                    completion:^(BOOL success, NSError * _Nullable error) {
        if (success) {
            self.pendingOperations[fileName] = metadata;
            [self triggerSyncIfNeeded];
            if (completion) completion(YES, nil);
        } else {
            self.lastError = error;
            if (completion) completion(NO, error);
        }
    }];
}

#pragma mark - Kindle Content Capture

- (void)captureKindleContent:(NSArray *)highlights
                  bookTitle:(NSString *)bookTitle
                completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    
    if (!highlights.count || !bookTitle.length) {
        NSError *error = errorWithCode(MEMBO_ERROR_VALIDATION, @{
            @"message": @"Highlights and book title are required"
        });
        if (completion) completion(NO, error);
        return;
    }
    
    NSString *fileName = [NSString stringWithFormat:@"kindle_%@_%@",
                         bookTitle,
                         [[NSUUID UUID] UUIDString]];
    
    NSMutableArray *processedHighlights = [NSMutableArray array];
    for (NSDictionary *highlight in highlights) {
        NSMutableDictionary *processed = [highlight mutableCopy];
        processed[@"timestamp"] = @([[NSDate date] timeIntervalSince1970]);
        [processedHighlights addObject:processed];
    }
    
    NSDictionary *content = @{
        @"bookTitle": bookTitle,
        @"highlights": processedHighlights,
        @"captureDate": @([[NSDate date] timeIntervalSince1970])
    };
    
    NSData *contentData = [NSJSONSerialization dataWithJSONObject:content
                                                         options:0
                                                           error:nil];
    
    [self.fileManager saveContent:contentData
                       fileName:fileName
                    completion:^(BOOL success, NSError * _Nullable error) {
        if (success) {
            self.pendingOperations[fileName] = @{
                @"type": @"kindle",
                @"bookTitle": bookTitle,
                @"highlightCount": @(highlights.count),
                @"timestamp": @([[NSDate date] timeIntervalSince1970])
            };
            [self triggerSyncIfNeeded];
            if (completion) completion(YES, nil);
        } else {
            self.lastError = error;
            if (completion) completion(NO, error);
        }
    }];
}

#pragma mark - Content Synchronization

- (void)syncContent:(void (^)(BOOL success, NSError * _Nullable error))completion {
    if (self.pendingOperations.count == 0) {
        if (completion) completion(YES, nil);
        return;
    }
    
    NSOperation *syncOperation = [NSBlockOperation blockOperationWithBlock:^{
        // Create a local copy of pending operations
        NSDictionary *operationsToSync = [self.pendingOperations copy];
        
        // Attempt to sync each operation
        for (NSString *fileName in operationsToSync) {
            [self syncFileWithName:fileName metadata:operationsToSync[fileName]];
        }
    }];
    
    syncOperation.completionBlock = ^{
        if (self.retryCount >= kMaxRetryAttempts) {
            NSError *error = errorWithCode(MEMBO_ERROR_NETWORK, @{
                @"message": @"Max retry attempts reached"
            });
            self.lastError = error;
            if (completion) completion(NO, error);
        } else {
            if (completion) completion(YES, nil);
        }
    };
    
    [self.syncQueue addOperation:syncOperation];
}

#pragma mark - Private Methods

- (void)syncFileWithName:(NSString *)fileName metadata:(NSDictionary *)metadata {
    [self.fileManager loadContent:fileName completion:^(NSData * _Nullable data, NSError * _Nullable error) {
        if (data) {
            // Implement actual sync with backend here
            // This is a placeholder for the sync implementation
            BOOL syncSuccess = YES; // Replace with actual sync result
            
            if (syncSuccess) {
                [self.pendingOperations removeObjectForKey:fileName];
                self.retryCount = 0;
            } else {
                self.retryCount++;
                if (self.retryCount < kMaxRetryAttempts) {
                    // Implement exponential backoff
                    NSTimeInterval delay = pow(2, self.retryCount);
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                                 dispatch_get_main_queue(), ^{
                        [self syncFileWithName:fileName metadata:metadata];
                    });
                }
            }
        }
    }];
}

- (void)triggerSyncIfNeeded {
    if (self.pendingOperations.count >= 5) { // Threshold for auto-sync
        [self syncContent:nil];
    }
}

- (void)handleMemoryWarning {
    [self.syncQueue cancelAllOperations];
    [self.pendingOperations removeAllObjects];
    self.retryCount = 0;
}

@end