//
//  FileManager.m
//  membo
//
//  Created for membo.ai
//  Copyright © 2024 membo.ai. All rights reserved.
//

#import "FileManager.h"

// Static variables
static FileManager *sharedInstance = nil;
static dispatch_queue_t fileOperationQueue;
static NSCache *contentCache;

// Constants
NSString *const kContentDirectory = @"content";
NSString *const kVoiceDirectory = @"voice";
NSString *const kFilePrefix = @"membo_";
NSString *const kErrorDomain = @"ai.membo.filemanager";

// Error codes
typedef NS_ENUM(NSInteger, FileManagerErrorCode) {
    FileManagerErrorInvalidInput = 1001,
    FileManagerErrorFileOperationFailed = 1002,
    FileManagerErrorFileNotFound = 1003
};

@interface FileManager ()

@property (nonatomic, strong) NSString *documentsDirectory;
@property (nonatomic, strong) NSString *temporaryDirectory;
@property (nonatomic, strong) NSError *lastError;
@property (nonatomic, strong) NSFileManager *fileManager;

@end

@implementation FileManager

#pragma mark - Initialization

+ (void)initialize {
    if (self == [FileManager class]) {
        fileOperationQueue = dispatch_queue_create("ai.membo.filemanager", DISPATCH_QUEUE_SERIAL);
        contentCache = [[NSCache alloc] init];
        contentCache.countLimit = 100; // Limit cache to 100 items
        contentCache.totalCostLimit = 50 * 1024 * 1024; // 50MB cache limit
    }
}

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] initPrivate];
    });
    return sharedInstance;
}

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _fileManager = [NSFileManager defaultManager];
        
        // Setup directories
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        _documentsDirectory = [paths firstObject];
        _temporaryDirectory = NSTemporaryDirectory();
        
        // Create required directories
        [self createDirectoryAtPath:[self.documentsDirectory stringByAppendingPathComponent:kContentDirectory]];
        [self createDirectoryAtPath:[self.documentsDirectory stringByAppendingPathComponent:kVoiceDirectory]];
        
        // Register for memory warnings
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
    }
    return self;
}

#pragma mark - Public Methods

- (void)saveContent:(NSData *)contentData 
           fileName:(NSString *)fileName 
        completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    if (!contentData || !fileName.length) {
        NSError *error = [self errorWithCode:FileManagerErrorInvalidInput
                                description:@"Invalid content data or filename"];
        completion(NO, error);
        return;
    }
    
    dispatch_async(fileOperationQueue, ^{
        NSString *filePath = [self contentPathForFileName:fileName];
        NSString *tempPath = [self.temporaryDirectory stringByAppendingPathComponent:
                            [NSUUID UUID].UUIDString];
        
        NSError *error = nil;
        BOOL success = [contentData writeToFile:tempPath options:NSDataWritingAtomic error:&error];
        
        if (success) {
            // Move from temp to final location
            success = [self.fileManager moveItemAtPath:tempPath toPath:filePath error:&error];
            if (success) {
                // Update cache
                [contentCache setObject:contentData forKey:fileName cost:contentData.length];
            }
        }
        
        self.lastError = error;
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(success, error);
        });
    });
}

- (void)loadContent:(NSString *)fileName 
        completion:(void (^)(NSData * _Nullable data, NSError * _Nullable error))completion {
    // Check cache first
    NSData *cachedData = [contentCache objectForKey:fileName];
    if (cachedData) {
        completion(cachedData, nil);
        return;
    }
    
    dispatch_async(fileOperationQueue, ^{
        NSString *filePath = [self contentPathForFileName:fileName];
        NSError *error = nil;
        NSData *data = [NSData dataWithContentsOfFile:filePath options:NSDataReadingMappedIfSafe error:&error];
        
        if (data) {
            [contentCache setObject:data forKey:fileName cost:data.length];
        }
        
        self.lastError = error;
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(data, error);
        });
    });
}

- (void)saveVoiceRecording:(NSData *)audioData 
               recordingId:(NSString *)recordingId 
               completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    if (!audioData || !recordingId.length) {
        NSError *error = [self errorWithCode:FileManagerErrorInvalidInput
                                description:@"Invalid audio data or recording ID"];
        completion(NO, error);
        return;
    }
    
    dispatch_async(fileOperationQueue, ^{
        NSString *fileName = [NSString stringWithFormat:@"%@%@.m4a", kFilePrefix, recordingId];
        NSString *filePath = [self.temporaryDirectory stringByAppendingPathComponent:fileName];
        
        NSError *error = nil;
        BOOL success = [audioData writeToFile:filePath options:NSDataWritingAtomic error:&error];
        
        if (success) {
            // Set file attributes for expiration
            NSDictionary *attributes = @{
                NSFileModificationDate: [NSDate date]
            };
            [self.fileManager setAttributes:attributes ofItemAtPath:filePath error:&error];
        }
        
        self.lastError = error;
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(success, error);
        });
    });
}

- (void)cleanupTemporaryFiles:(NSTimeInterval)maxAge 
                  completion:(void (^)(NSUInteger count, NSError * _Nullable error))completion {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
        NSError *error = nil;
        NSArray *tempFiles = [self.fileManager contentsOfDirectoryAtPath:self.temporaryDirectory error:&error];
        NSUInteger deletedCount = 0;
        
        if (!error) {
            NSDate *cutoffDate = [NSDate dateWithTimeIntervalSinceNow:-maxAge];
            
            for (NSString *fileName in tempFiles) {
                if ([fileName hasPrefix:kFilePrefix]) {
                    NSString *filePath = [self.temporaryDirectory stringByAppendingPathComponent:fileName];
                    NSDictionary *attributes = [self.fileManager attributesOfItemAtPath:filePath error:nil];
                    NSDate *modificationDate = attributes[NSFileModificationDate];
                    
                    if ([modificationDate compare:cutoffDate] == NSOrderedAscending) {
                        if ([self.fileManager removeItemAtPath:filePath error:nil]) {
                            deletedCount++;
                        }
                    }
                }
            }
        }
        
        self.lastError = error;
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(deletedCount, error);
        });
    });
}

#pragma mark - Private Methods

- (void)createDirectoryAtPath:(NSString *)path {
    NSError *error = nil;
    if (![self.fileManager fileExistsAtPath:path]) {
        [self.fileManager createDirectoryAtPath:path
                   withIntermediateDirectories:YES
                                    attributes:nil
                                         error:&error];
    }
    self.lastError = error;
}

- (NSString *)contentPathForFileName:(NSString *)fileName {
    return [[self.documentsDirectory stringByAppendingPathComponent:kContentDirectory]
            stringByAppendingPathComponent:fileName];
}

- (NSError *)errorWithCode:(FileManagerErrorCode)code description:(NSString *)description {
    return [NSError errorWithDomain:kErrorDomain
                             code:code
                         userInfo:@{NSLocalizedDescriptionKey: description}];
}

- (void)handleMemoryWarning {
    [contentCache removeAllObjects];
}

#pragma mark - Cleanup

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end