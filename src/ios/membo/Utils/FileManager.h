//
//  FileManager.h
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// Constants for directory names and file operations
extern NSString *const kContentDirectory;
extern NSString *const kVoiceDirectory;
extern NSString *const kFilePrefix;
extern NSString *const kMaxFileAge;
extern NSString *const kErrorDomain;

/**
 * FileManager
 * Thread-safe singleton class responsible for managing file system operations
 * for content storage, voice recordings, and study materials.
 *
 * Features:
 * - Asynchronous file operations using GCD
 * - Content caching for improved performance
 * - Secure file deletion
 * - Automatic cleanup of temporary files
 * - Error handling and reporting
 */
@interface FileManager : NSObject

/**
 * Documents directory path for persistent storage
 */
@property (nonatomic, strong, readonly) NSString *documentsDirectory;

/**
 * Temporary directory path for voice recordings
 */
@property (nonatomic, strong, readonly) NSString *temporaryDirectory;

/**
 * Last error encountered during file operations
 */
@property (nonatomic, strong, readonly, nullable) NSError *lastError;

/**
 * Returns the shared FileManager instance
 * Thread-safe singleton implementation
 */
+ (instancetype)sharedInstance;

/**
 * Saves content data to local storage with caching
 * @param contentData Data to be saved
 * @param fileName Name of the file to save
 * @param completion Block called with operation result
 */
- (void)saveContent:(NSData *)contentData
           fileName:(NSString *)fileName
        completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Loads content from cache or local storage
 * @param fileName Name of the file to load
 * @param completion Block called with loaded data or error
 */
- (void)loadContent:(NSString *)fileName
        completion:(void (^)(NSData * _Nullable data, NSError * _Nullable error))completion;

/**
 * Deletes content from local storage and cache
 * @param fileName Name of the file to delete
 * @param completion Block called with operation result
 */
- (void)deleteContent:(NSString *)fileName
          completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Saves voice recording to temporary storage
 * @param audioData Voice recording data
 * @param recordingId Unique identifier for the recording
 * @param completion Block called with operation result
 */
- (void)saveVoiceRecording:(NSData *)audioData
               recordingId:(NSString *)recordingId
               completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Removes expired temporary files and old voice recordings
 * @param maxAge Maximum age in seconds for temporary files
 * @param completion Block called with number of files deleted and any error
 */
- (void)cleanupTemporaryFiles:(NSTimeInterval)maxAge
                  completion:(void (^)(NSUInteger count, NSError * _Nullable error))completion;

// Prevent instance creation
- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;
- (id)copy NS_UNAVAILABLE;
- (id)mutableCopy NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END