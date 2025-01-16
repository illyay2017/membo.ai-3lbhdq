//
//  RNContentCaptureModule.h
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import <React/React.h>  // React Native iOS
#import <Foundation/Foundation.h>  // iOS SDK 12.0+
#import "Managers/ContentCaptureManager.h"
#import "Constants/ErrorCodes.h"

NS_ASSUME_NONNULL_BEGIN

// Error domain for React Native content capture operations
extern NSString *const RNContentCaptureErrorDomain;

/**
 * RNContentCaptureModule
 * Thread-safe React Native bridge module for content capture functionality
 * with comprehensive error handling and memory management.
 *
 * Provides JavaScript interface for:
 * - Web content capture
 * - PDF document processing
 * - Kindle highlight integration
 * - Content synchronization
 */
@interface RNContentCaptureModule : NSObject <RCTBridgeModule>

/**
 * ContentCaptureManager instance for handling capture operations
 */
@property (nonatomic, strong, readonly) ContentCaptureManager *contentCaptureManager;

/**
 * Captures web content with source URL using thread-safe operations
 *
 * @param content Dictionary containing content and metadata
 * @param resolve Promise resolution block
 * @param reject Promise rejection block
 */
RCT_EXTERN_METHOD(captureWebContent:(NSDictionary *)content
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Memory-efficient capture of PDF content with progressive loading
 *
 * @param base64Data Base64 encoded PDF data
 * @param fileName Name of the PDF file
 * @param resolve Promise resolution block
 * @param reject Promise rejection block
 */
RCT_EXTERN_METHOD(capturePDFContent:(NSString *)base64Data
                  fileName:(NSString *)fileName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Batch processing of Kindle highlights with error recovery
 *
 * @param highlights Array of highlight dictionaries
 * @param bookTitle Title of the Kindle book
 * @param resolve Promise resolution block
 * @param reject Promise rejection block
 */
RCT_EXTERN_METHOD(captureKindleContent:(NSArray *)highlights
                  bookTitle:(NSString *)bookTitle
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/**
 * Reliable content synchronization with retry logic and conflict resolution
 *
 * @param resolve Promise resolution block
 * @param reject Promise rejection block
 */
RCT_EXTERN_METHOD(syncContent:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Prevent instance creation
- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;
- (id)copy NS_UNAVAILABLE;
- (id)mutableCopy NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END