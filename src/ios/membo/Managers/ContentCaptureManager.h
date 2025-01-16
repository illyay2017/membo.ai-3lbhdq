//
//  ContentCaptureManager.h
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import <Foundation/Foundation.h>  // Foundation v17.0+
#import "FileManager.h"
#import "ErrorCodes.h"

NS_ASSUME_NONNULL_BEGIN

/// Error domain for content capture operations
extern NSString *const kContentCaptureErrorDomain;

/**
 * ContentCaptureManager
 * Thread-safe singleton class responsible for managing content capture operations
 * including web highlights, PDF content, and Kindle integration with robust error
 * handling and offline support.
 */
@interface ContentCaptureManager : NSObject

/**
 * File manager instance for content storage operations
 */
@property (nonatomic, strong, readonly) FileManager *fileManager;

/**
 * Last error encountered during capture operations
 */
@property (nonatomic, strong, readonly, nullable) NSError *lastError;

/**
 * Returns the shared ContentCaptureManager instance
 * Thread-safe singleton implementation
 */
+ (instancetype)sharedInstance;

/**
 * Captures and processes web content asynchronously
 *
 * @param content The web content to capture
 * @param sourceUrl Source URL of the captured content
 * @param completion Block called with operation result and any error
 */
- (void)captureWebContent:(NSString *)content
                sourceUrl:(NSString *)sourceUrl
              completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Captures and processes PDF document content asynchronously
 *
 * @param pdfData Raw PDF data to process
 * @param fileName Name of the PDF file
 * @param completion Block called with operation result and any error
 */
- (void)capturePDFContent:(NSData *)pdfData
                fileName:(NSString *)fileName
              completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Captures and processes Kindle book highlights asynchronously
 *
 * @param highlights Array of highlight dictionaries
 * @param bookTitle Title of the Kindle book
 * @param completion Block called with operation result and any error
 */
- (void)captureKindleContent:(NSArray *)highlights
                  bookTitle:(NSString *)bookTitle
                completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Synchronizes captured content with backend using retry logic
 *
 * @param completion Block called with sync result and any error
 */
- (void)syncContent:(void (^)(BOOL success, NSError * _Nullable error))completion;

// Prevent instance creation
- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;
- (id)copy NS_UNAVAILABLE;
- (id)mutableCopy NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END