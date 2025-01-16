//
//  AudioSessionManager.m
//  membo
//
//  Created for membo.ai voice-based study features
//  Version: 1.0
//

#import "Utils/AudioSessionManager.h"
#import "Constants/VoiceConstants.h"

// Static instance variables
static AudioSessionManager *sharedManager = nil;
static dispatch_queue_t audioQueue = nil;

@interface AudioSessionManager ()

@property (nonatomic, strong) AVAudioSession *audioSession;
@property (nonatomic, assign) BOOL isAudioSessionActive;
@property (nonatomic, strong) NSError *lastError;
@property (nonatomic, strong) NSMutableArray *interruptionHistory;
@property (nonatomic, strong) dispatch_queue_t synchronizationQueue;
@property (nonatomic, strong) NSMutableDictionary *sessionState;

@end

@implementation AudioSessionManager

#pragma mark - Lifecycle

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[self alloc] initPrivate];
        audioQueue = dispatch_queue_create("ai.membo.audioSessionQueue", DISPATCH_QUEUE_SERIAL);
    });
    return sharedManager;
}

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _synchronizationQueue = dispatch_queue_create("ai.membo.audioSessionSync", DISPATCH_QUEUE_SERIAL);
        _audioSession = [AVAudioSession sharedInstance];
        _interruptionHistory = [NSMutableArray new];
        _sessionState = [NSMutableDictionary new];
        _isAudioSessionActive = NO;
        
        // Register for notifications
        NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
        [center addObserver:self
                 selector:@selector(handleAudioSessionInterruption:)
                     name:AVAudioSessionInterruptionNotification
                   object:nil];
        
        [center addObserver:self
                 selector:@selector(handleAudioRouteChange:)
                     name:AVAudioSessionRouteChangeNotification
                   object:nil];
        
        [center addObserver:self
                 selector:@selector(handleApplicationBackground:)
                     name:UIApplicationDidEnterBackgroundNotification
                   object:nil];
        
        [center addObserver:self
                 selector:@selector(handleApplicationForeground:)
                     name:UIApplicationWillEnterForegroundNotification
                   object:nil];
    }
    return self;
}

#pragma mark - Audio Session Configuration

- (BOOL)configureAudioSession {
    __block BOOL success = NO;
    __block NSError *error = nil;
    
    dispatch_sync(_synchronizationQueue, ^{
        // Configure category and mode
        success = [self.audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
                                   withOptions:AVAudioSessionCategoryOptionAllowBluetooth |
                                             AVAudioSessionCategoryOptionDefaultToSpeaker
                                         error:&error];
        
        if (!success) {
            self.lastError = error;
            return;
        }
        
        // Set mode for voice chat
        success = [self.audioSession setMode:AVAudioSessionModeVoiceChat error:&error];
        if (!success) {
            self.lastError = error;
            return;
        }
        
        // Configure audio settings
        success = [self.audioSession setPreferredSampleRate:kAudioSampleRate error:&error];
        if (!success) {
            self.lastError = error;
            return;
        }
        
        // Set I/O buffer duration
        success = [self.audioSession setPreferredIOBufferDuration:0.005 error:&error];
        if (!success) {
            self.lastError = error;
            return;
        }
        
        [self.sessionState setObject:@(kAudioSampleRate) forKey:@"sampleRate"];
        [self.sessionState setObject:@(kAudioChannels) forKey:@"channels"];
        [self.sessionState setObject:@(kAudioBitDepth) forKey:@"bitDepth"];
    });
    
    return success;
}

#pragma mark - Session Management

- (BOOL)activateAudioSession {
    __block BOOL success = NO;
    __block NSError *error = nil;
    
    dispatch_sync(_synchronizationQueue, ^{
        if (self.isAudioSessionActive) {
            success = YES;
            return;
        }
        
        success = [self.audioSession setActive:YES error:&error];
        if (!success) {
            self.lastError = error;
            return;
        }
        
        self.isAudioSessionActive = YES;
        [self.sessionState setObject:@(YES) forKey:@"isActive"];
        
        [[NSNotificationCenter defaultCenter] postNotificationName:@"AudioSessionDidActivate" 
                                                          object:self];
    });
    
    return success;
}

- (BOOL)deactivateAudioSession {
    __block BOOL success = NO;
    __block NSError *error = nil;
    
    dispatch_sync(_synchronizationQueue, ^{
        if (!self.isAudioSessionActive) {
            success = YES;
            return;
        }
        
        success = [self.audioSession setActive:NO 
                                 withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                     error:&error];
        if (!success) {
            self.lastError = error;
            return;
        }
        
        self.isAudioSessionActive = NO;
        [self.sessionState setObject:@(NO) forKey:@"isActive"];
        
        [[NSNotificationCenter defaultCenter] postNotificationName:@"AudioSessionDidDeactivate" 
                                                          object:self];
    });
    
    return success;
}

#pragma mark - Interruption Handling

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    NSDictionary *interruptionDict = notification.userInfo;
    AVAudioSessionInterruptionType interruptionType = [interruptionDict[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue];
    
    dispatch_async(_synchronizationQueue, ^{
        NSMutableDictionary *interruptionInfo = [NSMutableDictionary dictionary];
        [interruptionInfo setObject:@(interruptionType) forKey:@"type"];
        [interruptionInfo setObject:[NSDate date] forKey:@"timestamp"];
        [self.interruptionHistory addObject:interruptionInfo];
        
        if (interruptionType == AVAudioSessionInterruptionTypeBegan) {
            self.isAudioSessionActive = NO;
            [self.sessionState setObject:@(NO) forKey:@"isActive"];
            [[NSNotificationCenter defaultCenter] postNotificationName:@"AudioSessionInterrupted" 
                                                              object:self];
        } 
        else if (interruptionType == AVAudioSessionInterruptionTypeEnded) {
            AVAudioSessionInterruptionOptions options = [interruptionDict[AVAudioSessionInterruptionOptionKey] unsignedIntegerValue];
            if (options & AVAudioSessionInterruptionOptionShouldResume) {
                [self activateAudioSession];
            }
        }
    });
}

#pragma mark - Route Change Handling

- (void)handleAudioRouteChange:(NSNotification *)notification {
    dispatch_async(_synchronizationQueue, ^{
        NSDictionary *routeChangeDict = notification.userInfo;
        AVAudioSessionRouteChangeReason reason = [routeChangeDict[AVAudioSessionRouteChangeReasonKey] unsignedIntegerValue];
        
        [self.sessionState setObject:@(reason) forKey:@"lastRouteChangeReason"];
        
        if (reason == AVAudioSessionRouteChangeReasonCategoryChange) {
            [self configureAudioSession];
        }
        
        AVAudioSessionRouteDescription *currentRoute = self.audioSession.currentRoute;
        [self.sessionState setObject:currentRoute.description forKey:@"currentRoute"];
        
        [[NSNotificationCenter defaultCenter] postNotificationName:@"AudioSessionRouteChanged" 
                                                          object:self 
                                                        userInfo:@{@"reason": @(reason)}];
    });
}

#pragma mark - Application State Handling

- (void)handleApplicationBackground:(NSNotification *)notification {
    dispatch_async(_synchronizationQueue, ^{
        if (self.isAudioSessionActive) {
            [self deactivateAudioSession];
        }
    });
}

- (void)handleApplicationForeground:(NSNotification *)notification {
    dispatch_async(_synchronizationQueue, ^{
        if ([self.sessionState[@"wasActiveBeforeBackground"] boolValue]) {
            [self activateAudioSession];
        }
    });
}

#pragma mark - Cleanup

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self deactivateAudioSession];
    self.interruptionHistory = nil;
    self.sessionState = nil;
}

@end