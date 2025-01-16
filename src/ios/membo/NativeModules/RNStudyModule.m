//
//  RNStudyModule.m
//  membo
//
//  React Native bridge module implementation for study functionality
//  with enhanced voice capabilities and performance tracking.
//  React version: 0.72.x
//  Foundation.framework version: iOS SDK 12.0+
//

#import "RNStudyModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>

@implementation RNStudyModule {
    StudyManager *_studyManager;
    dispatch_queue_t _synchronizationQueue;
    NSLock *_statsLock;
    NSMutableDictionary *_sessionStats;
    AudioSessionManager *_audioManager;
}

#pragma mark - Initialization

- (instancetype)init {
    if (self = [super init]) {
        // Initialize study manager and set delegate
        _studyManager = [StudyManager sharedInstance];
        _studyManager.delegate = self;
        
        // Create synchronization queue with user-initiated QoS
        _synchronizationQueue = dispatch_queue_create("ai.membo.studymodule.sync",
                                                    dispatch_queue_attr_make_with_qos_class(
                                                        DISPATCH_QUEUE_SERIAL,
                                                        QOS_CLASS_USER_INITIATED, 0));
        
        // Initialize thread-safe statistics tracking
        _statsLock = [[NSLock alloc] init];
        _sessionStats = [NSMutableDictionary dictionary];
        
        // Initialize audio session manager for voice features
        _audioManager = [AudioSessionManager sharedInstance];
        
        // Register for memory warning notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
    }
    return self;
}

#pragma mark - RCTBridgeModule Implementation

+ (NSString *)moduleName {
    return @"RNStudyModule";
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

#pragma mark - Public Methods

RCT_EXPORT_METHOD(startStudySession:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_synchronizationQueue, ^{
        @try {
            // Validate study mode
            NSNumber *modeNumber = config[@"mode"];
            MBStudyMode mode = [modeNumber integerValue];
            if (mode < MBStudyModeStandard || mode > MBStudyModeQuiz) {
                reject(@"invalid_mode", @"Invalid study mode specified", nil);
                return;
            }
            
            // Create study mode configuration
            MBStudyModeConfig modeConfig = {
                .sessionDuration = [config[@"duration"] doubleValue] ?: MB_DEFAULT_SESSION_DURATION,
                .allowVoiceInput = [config[@"enableVoice"] boolValue],
                .showConfidenceButtons = [config[@"showConfidence"] boolValue] ?: YES,
                .enableFSRS = [config[@"enableFSRS"] boolValue] ?: YES,
                .minCardsPerSession = [config[@"minCards"] integerValue] ?: MB_MIN_CARDS_PER_SESSION,
                .maxCardsPerSession = [config[@"maxCards"] integerValue] ?: MB_MAX_CARDS_PER_SESSION,
                .voiceConfidenceThreshold = [config[@"voiceThreshold"] floatValue] ?: MB_DEFAULT_VOICE_CONFIDENCE_THRESHOLD,
                .enableAutoAdvance = [config[@"autoAdvance"] boolValue],
                .cardDisplayDuration = [config[@"cardDuration"] doubleValue] ?: 0.0,
                .enableHapticFeedback = [config[@"hapticFeedback"] boolValue] ?: YES
            };
            
            // Configure voice processing if enabled
            if (modeConfig.allowVoiceInput) {
                if (![self configureVoiceProcessing]) {
                    reject(@"voice_setup_failed", @"Failed to configure voice processing", nil);
                    return;
                }
            }
            
            // Initialize session statistics
            [_statsLock lock];
            [_sessionStats removeAllObjects];
            _sessionStats[@"startTime"] = @([[NSDate date] timeIntervalSince1970]);
            _sessionStats[@"mode"] = @(mode);
            [_statsLock unlock];
            
            // Start study session
            if ([_studyManager startStudySession:mode config:&modeConfig]) {
                resolve(@{@"success": @YES});
            } else {
                reject(@"session_start_failed", @"Failed to start study session", nil);
            }
        } @catch (NSException *exception) {
            reject(@"unexpected_error", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(submitCardResponse:(NSInteger)confidence
                  voiceInput:(nullable NSString *)voiceInput
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_synchronizationQueue, ^{
        @try {
            // Validate confidence rating
            if (confidence < 1 || confidence > 5) {
                reject(@"invalid_confidence", @"Confidence rating must be between 1 and 5", nil);
                return;
            }
            
            // Update session statistics atomically
            [_statsLock lock];
            NSNumber *responses = _sessionStats[@"totalResponses"];
            _sessionStats[@"totalResponses"] = @(responses.integerValue + 1);
            _sessionStats[@"lastConfidence"] = @(confidence);
            [_statsLock unlock];
            
            // Process card response
            if ([_studyManager processCardResponse:confidence voiceInput:voiceInput]) {
                resolve(@{
                    @"success": @YES,
                    @"confidence": @(confidence),
                    @"hasVoiceInput": @(voiceInput != nil)
                });
            } else {
                reject(@"response_failed", @"Failed to process card response", nil);
            }
        } @catch (NSException *exception) {
            reject(@"unexpected_error", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(endStudySession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(_synchronizationQueue, ^{
        @try {
            // Calculate final session statistics
            [_statsLock lock];
            _sessionStats[@"endTime"] = @([[NSDate date] timeIntervalSince1970]);
            NSTimeInterval duration = [_sessionStats[@"endTime"] doubleValue] - 
                                    [_sessionStats[@"startTime"] doubleValue];
            _sessionStats[@"duration"] = @(duration);
            [_statsLock unlock];
            
            // End study session
            [_studyManager endStudySession];
            
            // Clean up voice processing if needed
            if (_studyManager.currentConfig.allowVoiceInput) {
                [_audioManager deactivateAudioSession];
            }
            
            resolve(_sessionStats);
        } @catch (NSException *exception) {
            reject(@"unexpected_error", exception.reason, nil);
        }
    });
}

#pragma mark - MBStudyManagerDelegate Implementation

- (void)didStartStudySession:(MBStudyMode)mode config:(MBStudyModeConfig *)config {
    [_statsLock lock];
    _sessionStats[@"activeMode"] = @(mode);
    _sessionStats[@"voiceEnabled"] = @(config->allowVoiceInput);
    [_statsLock unlock];
    
    [self sendEventWithName:@"studySessionStarted" body:@{
        @"mode": @(mode),
        @"voiceEnabled": @(config->allowVoiceInput),
        @"timestamp": @([[NSDate date] timeIntervalSince1970])
    }];
}

- (void)didCompleteStudySession:(NSDictionary<NSString *, NSNumber *> *)stats {
    [_statsLock lock];
    [_sessionStats addEntriesFromDictionary:stats];
    [_statsLock unlock];
    
    [self sendEventWithName:@"studySessionCompleted" body:_sessionStats];
}

#pragma mark - Private Methods

- (BOOL)configureVoiceProcessing {
    if (![_audioManager configureAudioSession]) {
        return NO;
    }
    return [_audioManager activateAudioSession];
}

- (void)handleMemoryWarning {
    // Clean up non-essential resources
    [_statsLock lock];
    [_sessionStats removeObjectsForKeys:@[@"interimStats", @"debugInfo"]];
    [_statsLock unlock];
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end