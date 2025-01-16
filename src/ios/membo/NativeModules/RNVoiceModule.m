//
//  RNVoiceModule.m
//  membo
//
//  Created for membo.ai voice recognition system
//  Version: 1.0
//

#import "RNVoiceModule.h"

// Maximum number of retry attempts for voice recognition
static const NSInteger kMaxRetryAttempts = 3;

// Retry delay in seconds
static const NSTimeInterval kRetryDelay = 1.0;

@implementation RNVoiceModule

#pragma mark - React Native Setup

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

#pragma mark - Initialization

- (instancetype)init {
    self = [super init];
    if (self) {
        _voiceManager = [VoiceManager sharedInstance];
        _operationLock = [[NSLock alloc] init];
        _retryCount = 0;
        _isRecognitionActive = NO;
        
        // Register for memory warning notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning:)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
    }
    return self;
}

#pragma mark - Constants Export

- (NSDictionary *)constantsToExport {
    NSMutableDictionary *constants = [NSMutableDictionary dictionary];
    
    // Error codes
    constants[@"ERROR_NO_PERMISSION"] = @(VoiceRecognitionErrorNoPermission);
    constants[@"ERROR_NOT_AVAILABLE"] = @(VoiceRecognitionErrorNotAvailable);
    constants[@"ERROR_TIMEOUT"] = @(VoiceRecognitionErrorTimeout);
    constants[@"ERROR_AUDIO_SESSION"] = @(VoiceRecognitionErrorAudioSession);
    constants[@"ERROR_UNKNOWN"] = @(VoiceRecognitionErrorUnknown);
    
    // Recognition states
    constants[@"STATE_IDLE"] = @(VoiceRecognitionStateIdle);
    constants[@"STATE_LISTENING"] = @(VoiceRecognitionStateListening);
    constants[@"STATE_PROCESSING"] = @(VoiceRecognitionStateProcessing);
    constants[@"STATE_FINISHED"] = @(VoiceRecognitionStateFinished);
    
    // Configuration
    constants[@"MAX_RETRY_ATTEMPTS"] = @(kMaxRetryAttempts);
    constants[@"RETRY_DELAY"] = @(kRetryDelay);
    constants[@"RECOGNITION_TIMEOUT"] = @(kVoiceRecognitionTimeout);
    
    return [NSDictionary dictionaryWithDictionary:constants];
}

#pragma mark - Voice Recognition Methods

RCT_EXPORT_METHOD(startVoiceRecognition:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    if (![_operationLock tryLock]) {
        reject(@"BUSY", @"Voice recognition already in progress", nil);
        return;
    }
    
    @try {
        // Store callbacks atomically
        self.currentResolveBlock = resolve;
        self.currentRejectBlock = reject;
        self.retryCount = 0;
        self.isRecognitionActive = YES;
        
        __weak typeof(self) weakSelf = self;
        [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
            typeof(self) strongSelf = weakSelf;
            if (!strongSelf) return;
            
            if (error) {
                if (strongSelf.retryCount < kMaxRetryAttempts && 
                    [strongSelf shouldRetryError:error]) {
                    strongSelf.retryCount++;
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kRetryDelay * NSEC_PER_SEC)),
                                 dispatch_get_main_queue(), ^{
                        [strongSelf retryVoiceRecognition];
                    });
                    return;
                }
                
                [strongSelf handleRecognitionError:error];
                return;
            }
            
            if (result) {
                strongSelf.currentResolveBlock(result);
            } else {
                strongSelf.currentRejectBlock(@"NO_RESULT", @"No recognition result", nil);
            }
            
            [strongSelf cleanupRecognition];
        }];
    } @catch (NSException *exception) {
        [self handleException:exception];
    }
}

RCT_EXPORT_METHOD(stopVoiceRecognition:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    if (![_operationLock tryLock]) {
        reject(@"BUSY", @"Cannot stop: operation in progress", nil);
        return;
    }
    
    @try {
        if (!self.isRecognitionActive) {
            [_operationLock unlock];
            resolve(@(YES));
            return;
        }
        
        [self.voiceManager stopVoiceRecognition];
        [self cleanupRecognition];
        resolve(@(YES));
        
    } @catch (NSException *exception) {
        [self handleException:exception];
        reject(@"STOP_FAILED", exception.reason, nil);
    } @finally {
        [_operationLock unlock];
    }
}

RCT_EXPORT_METHOD(isVoiceRecognitionAvailable:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    @try {
        BOOL isAvailable = [self.voiceManager isAvailable];
        resolve(@(isAvailable));
    } @catch (NSException *exception) {
        reject(@"CHECK_FAILED", exception.reason, nil);
    }
}

#pragma mark - Private Methods

- (void)retryVoiceRecognition {
    if (!self.isRecognitionActive) return;
    
    [self.voiceManager startVoiceRecognition:^(NSString * _Nullable result, NSError * _Nullable error) {
        if (error) {
            [self handleRecognitionError:error];
            return;
        }
        
        if (result) {
            self.currentResolveBlock(result);
        } else {
            self.currentRejectBlock(@"NO_RESULT", @"No recognition result after retry", nil);
        }
        
        [self cleanupRecognition];
    }];
}

- (BOOL)shouldRetryError:(NSError *)error {
    // Retry for transient errors like timeout or audio session issues
    return (error.code == VoiceRecognitionErrorTimeout ||
            error.code == VoiceRecognitionErrorAudioSession);
}

- (void)handleRecognitionError:(NSError *)error {
    NSString *errorCode = [NSString stringWithFormat:@"ERR_%ld", (long)error.code];
    self.currentRejectBlock(errorCode, error.localizedDescription, error);
    [self cleanupRecognition];
}

- (void)handleException:(NSException *)exception {
    self.currentRejectBlock(@"EXCEPTION", exception.reason, nil);
    [self cleanupRecognition];
}

- (void)cleanupRecognition {
    self.isRecognitionActive = NO;
    self.retryCount = 0;
    self.currentResolveBlock = nil;
    self.currentRejectBlock = nil;
    [_operationLock unlock];
}

#pragma mark - Memory Management

- (void)handleMemoryWarning:(NSNotification *)notification {
    if (self.isRecognitionActive) {
        [self.voiceManager stopVoiceRecognition];
        [self cleanupRecognition];
        
        // Notify JavaScript of the interruption
        if (self.currentRejectBlock) {
            self.currentRejectBlock(@"MEMORY_WARNING", @"Recognition stopped due to memory warning", nil);
        }
    }
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    
    if (self.isRecognitionActive) {
        [self.voiceManager stopVoiceRecognition];
    }
    
    [self cleanupRecognition];
}

@end