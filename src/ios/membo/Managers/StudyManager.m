//
//  StudyManager.m
//  membo
//
//  Thread-safe implementation of study session management with FSRS scheduling
//  and voice learning support.
//

#import "StudyManager.h"

#pragma mark - Private Interface

@interface StudyManager ()

@property (nonatomic, weak, nullable) id<MBStudyManagerDelegate> delegate;
@property (nonatomic, assign) MBStudyMode currentMode;
@property (nonatomic, strong) MBStudyModeConfig *currentConfig;
@property (nonatomic, assign) BOOL isSessionActive;
@property (nonatomic, strong) NSArray<NSString *> *currentCardQueue;
@property (nonatomic, strong) NSMutableDictionary *sessionStats;
@property (nonatomic, strong) NSDate *sessionStartTime;
@property (nonatomic, assign) NSUInteger totalCardsReviewed;
@property (nonatomic, strong) NSMutableDictionary *voiceRecognitionStats;
@property (nonatomic, strong) NSMutableArray *errorLog;

@end

#pragma mark - Static Variables

static StudyManager *sharedInstance = nil;
static dispatch_once_t onceToken;
static dispatch_queue_t _syncQueue;
static NSLock *_statsLock;

#pragma mark - Implementation

@implementation StudyManager

#pragma mark - Lifecycle

+ (void)initialize {
    if (self == [StudyManager class]) {
        _syncQueue = dispatch_queue_create("ai.membo.studymanager.sync", DISPATCH_QUEUE_SERIAL);
        _statsLock = [[NSLock alloc] init];
    }
}

+ (instancetype)sharedInstance {
    dispatch_once(&onceToken, ^{
        sharedInstance = [[StudyManager alloc] initPrivate];
    });
    return sharedInstance;
}

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _currentMode = MBStudyModeStandard;
        _currentConfig = kMBDefaultStudyModeConfigs[@(MBStudyModeStandard)];
        _isSessionActive = NO;
        _currentCardQueue = @[];
        _sessionStats = [NSMutableDictionary dictionary];
        _voiceRecognitionStats = [NSMutableDictionary dictionary];
        _errorLog = [NSMutableArray array];
        
        // Register for system notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleMemoryWarning)
                                                   name:UIApplicationDidReceiveMemoryWarningNotification
                                                 object:nil];
        
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleAppStateTransition:)
                                                   name:UIApplicationWillResignActiveNotification
                                                 object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self endStudySession];
    
    dispatch_sync(_syncQueue, ^{
        _currentCardQueue = nil;
        _sessionStats = nil;
        _voiceRecognitionStats = nil;
        _errorLog = nil;
        _delegate = nil;
    });
}

#pragma mark - Session Management

- (BOOL)startStudySession:(MBStudyMode)mode config:(MBStudyModeConfig *)config {
    if (self.isSessionActive) {
        [self logError:@"Attempted to start session while another is active"];
        return NO;
    }
    
    __block BOOL success = YES;
    
    dispatch_sync(_syncQueue, ^{
        // Validate configuration
        if (!config) {
            config = kMBDefaultStudyModeConfigs[@(mode)];
        }
        
        // Configure audio session for voice mode
        if (mode == MBStudyModeVoice) {
            success = [[AudioSessionManager sharedInstance] configureAudioSession];
            if (!success) {
                [self logError:@"Failed to configure audio session"];
                return;
            }
        }
        
        // Initialize session state
        self.currentMode = mode;
        self.currentConfig = config;
        self.sessionStartTime = [NSDate date];
        self.totalCardsReviewed = 0;
        
        [self.sessionStats removeAllObjects];
        [self.voiceRecognitionStats removeAllObjects];
        
        // Load initial card queue using FSRS algorithm
        success = [self loadCardQueue];
        
        if (success) {
            self.isSessionActive = YES;
            
            // Notify delegate on main thread
            dispatch_async(dispatch_get_main_queue(), ^{
                if ([self.delegate respondsToSelector:@selector(didStartStudySession:config:)]) {
                    [self.delegate didStartStudySession:mode config:config];
                }
            });
        }
    });
    
    return success;
}

- (void)endStudySession {
    if (!self.isSessionActive) {
        return;
    }
    
    dispatch_sync(_syncQueue, ^{
        // Calculate final statistics
        NSTimeInterval duration = [[NSDate date] timeIntervalSinceDate:self.sessionStartTime];
        
        [_statsLock lock];
        self.sessionStats[@"duration"] = @(duration);
        self.sessionStats[@"totalCards"] = @(self.totalCardsReviewed);
        self.sessionStats[@"completionRate"] = @(self.totalCardsReviewed / (float)self.currentCardQueue.count);
        
        if (self.currentMode == MBStudyModeVoice) {
            self.sessionStats[@"voiceAccuracy"] = [self calculateVoiceAccuracy];
            [[AudioSessionManager sharedInstance] deactivateAudioSession];
        }
        [_statsLock unlock];
        
        // Reset session state
        self.isSessionActive = NO;
        self.currentCardQueue = @[];
        self.sessionStartTime = nil;
        
        // Notify delegate with final statistics
        NSDictionary *finalStats = [self.sessionStats copy];
        dispatch_async(dispatch_get_main_queue(), ^{
            if ([self.delegate respondsToSelector:@selector(didCompleteStudySession:)]) {
                [self.delegate didCompleteStudySession:finalStats];
            }
        });
    });
}

- (BOOL)processCardResponse:(NSInteger)confidence voiceInput:(nullable NSString *)voiceInput {
    if (!self.isSessionActive) {
        return NO;
    }
    
    __block BOOL success = YES;
    
    dispatch_sync(_syncQueue, ^{
        // Process voice input if provided
        if (voiceInput && self.currentMode == MBStudyModeVoice) {
            CGFloat recognitionConfidence = [self processVoiceInput:voiceInput];
            
            dispatch_async(dispatch_get_main_queue(), ^{
                if ([self.delegate respondsToSelector:@selector(didReceiveVoiceInput:confidence:)]) {
                    [self.delegate didReceiveVoiceInput:voiceInput confidence:recognitionConfidence];
                }
            });
        }
        
        // Update FSRS scheduling data
        [self updateFSRSDataWithConfidence:confidence];
        
        // Update session statistics
        [_statsLock lock];
        self.totalCardsReviewed++;
        [self updateSessionStats:confidence voiceInput:voiceInput];
        [_statsLock unlock];
        
        // Check for session completion
        if ([self shouldEndSession]) {
            [self endStudySession];
        }
    });
    
    return success;
}

#pragma mark - Private Methods

- (BOOL)loadCardQueue {
    // Implementation would integrate with FSRS algorithm
    // to load and schedule cards based on review intervals
    return YES;
}

- (void)updateFSRSDataWithConfidence:(NSInteger)confidence {
    // Implementation would update FSRS scheduling data
    // based on user response confidence
}

- (void)updateSessionStats:(NSInteger)confidence voiceInput:(nullable NSString *)voiceInput {
    // Update comprehensive session statistics
    [_statsLock lock];
    NSNumber *currentCount = self.sessionStats[@(confidence)] ?: @0;
    self.sessionStats[@(confidence)] = @(currentCount.integerValue + 1);
    
    if (voiceInput) {
        [self updateVoiceStats:voiceInput];
    }
    [_statsLock unlock];
}

- (void)updateVoiceStats:(NSString *)voiceInput {
    // Track voice recognition statistics
    NSMutableDictionary *stats = self.voiceRecognitionStats;
    NSInteger totalAttempts = [stats[@"totalAttempts"] integerValue] + 1;
    stats[@"totalAttempts"] = @(totalAttempts);
}

- (NSNumber *)calculateVoiceAccuracy {
    if (self.voiceRecognitionStats.count == 0) {
        return @0;
    }
    
    NSInteger totalAttempts = [self.voiceRecognitionStats[@"totalAttempts"] integerValue];
    NSInteger successfulAttempts = [self.voiceRecognitionStats[@"successfulAttempts"] integerValue];
    
    return @(successfulAttempts / (float)totalAttempts);
}

- (BOOL)shouldEndSession {
    return self.totalCardsReviewed >= self.currentConfig.maxCardsPerSession ||
           [[NSDate date] timeIntervalSinceDate:self.sessionStartTime] >= self.currentConfig.sessionDuration;
}

- (void)logError:(NSString *)error {
    NSString *timestamp = [NSDateFormatter localizedStringFromDate:[NSDate date]
                                                       dateStyle:NSDateFormatterNoStyle
                                                       timeStyle:NSDateFormatterMediumStyle];
    [self.errorLog addObject:@{@"timestamp": timestamp, @"error": error}];
}

#pragma mark - Notification Handlers

- (void)handleMemoryWarning {
    // Handle low memory condition
    [self.errorLog removeAllObjects];
    [self.voiceRecognitionStats removeAllObjects];
}

- (void)handleAppStateTransition:(NSNotification *)notification {
    if (self.isSessionActive) {
        [self endStudySession];
    }
}

@end