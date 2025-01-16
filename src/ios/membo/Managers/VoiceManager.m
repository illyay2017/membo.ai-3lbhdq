//
//  VoiceManager.m
//  membo
//
//  Created for membo.ai voice recognition system
//  Version: 1.0
//

#import "VoiceManager.h"

#pragma mark - Constants

NSNotificationName const MBVoiceRecognitionStateDidChangeNotification = @"MBVoiceRecognitionStateDidChangeNotification";
NSNotificationName const MBVoiceRecognitionErrorNotification = @"MBVoiceRecognitionErrorNotification";
NSString * const MBVoiceRecognitionErrorDomain = @"ai.membo.voice";
NSString * const MBVoiceRecognitionNewStateKey = @"newState";
NSString * const MBVoiceRecognitionPreviousStateKey = @"previousState";

#pragma mark - Private Interface

@interface VoiceManager ()

@property (atomic, strong, readwrite) SFSpeechRecognizer *speechRecognizer;
@property (atomic, strong, readwrite) AVAudioEngine *audioEngine;
@property (atomic, strong, readwrite) SFSpeechRecognitionTask *recognitionTask;
@property (atomic, assign, readwrite) VoiceRecognitionState currentState;
@property (atomic, strong, readwrite) NSError *lastError;
@property (atomic, assign, readwrite) BOOL isProcessing;
@property (atomic, strong) NSTimer *timeoutTimer;
@property (atomic, strong, readwrite) NSString *currentLanguage;
@property (atomic, strong) NSOperationQueue *operationQueue;

@end

#pragma mark - Implementation

@implementation VoiceManager

#pragma mark - Singleton

static VoiceManager *sharedInstance = nil;
static dispatch_once_t onceToken;
static dispatch_queue_t voiceQueue;

+ (instancetype)sharedInstance {
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] initPrivate];
        voiceQueue = dispatch_queue_create("ai.membo.voiceQueue", DISPATCH_QUEUE_SERIAL);
    });
    return sharedInstance;
}

#pragma mark - Lifecycle

- (instancetype)initPrivate {
    self = [super init];
    if (self) {
        _currentState = VoiceRecognitionStateIdle;
        _isProcessing = NO;
        _currentLanguage = @"en-US";
        _operationQueue = [[NSOperationQueue alloc] init];
        _operationQueue.maxConcurrentOperationCount = 1;
        
        // Initialize speech recognizer with default locale
        _speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:_currentLanguage]];
        _audioEngine = [[AVAudioEngine alloc] init];
        
        // Register for audio session interruption notifications
        [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(handleAudioSessionInterruption:)
                                                   name:AVAudioSessionInterruptionNotification
                                                 object:nil];
        
        // Configure audio session
        [[AudioSessionManager sharedInstance] configureAudioSession];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self stopVoiceRecognition];
    [_operationQueue cancelAllOperations];
}

#pragma mark - Voice Recognition Control

- (void)startVoiceRecognition:(void (^)(NSString * _Nullable, NSError * _Nullable))completion {
    dispatch_async(voiceQueue, ^{
        if (self.isProcessing) {
            NSError *error = [NSError errorWithDomain:MBVoiceRecognitionErrorDomain
                                               code:VoiceRecognitionErrorUnknown
                                           userInfo:@{NSLocalizedDescriptionKey: @"Recognition already in progress"}];
            completion(nil, error);
            return;
        }
        
        // Check microphone permission
        [[PermissionManager sharedInstance] requestMicrophonePermission:^(BOOL granted, NSError * _Nullable error) {
            if (!granted) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(nil, error);
                });
                return;
            }
            
            // Configure and activate audio session
            if (![[AudioSessionManager sharedInstance] activateAudioSession]) {
                NSError *sessionError = [NSError errorWithDomain:MBVoiceRecognitionErrorDomain
                                                          code:VoiceRecognitionErrorAudioSession
                                                      userInfo:@{NSLocalizedDescriptionKey: @"Failed to activate audio session"}];
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(nil, sessionError);
                });
                return;
            }
            
            // Configure audio engine
            AVAudioInputNode *inputNode = self.audioEngine.inputNode;
            AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];
            
            [inputNode installTapOnBus:0
                          bufferSize:kVoiceBufferSize
                              format:recordingFormat
                               block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
                // Handle audio buffer if needed
            }];
            
            // Create recognition request
            SFSpeechAudioBufferRecognitionRequest *request = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
            request.shouldReportPartialResults = YES;
            
            __weak typeof(self) weakSelf = self;
            self.recognitionTask = [self.speechRecognizer recognitionTaskWithRequest:request
                                                                       resultHandler:^(SFSpeechRecognitionResult * _Nullable result,
                                                                                     NSError * _Nullable error) {
                __strong typeof(weakSelf) strongSelf = weakSelf;
                if (!strongSelf) return;
                
                if (error) {
                    [strongSelf stopVoiceRecognition];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        completion(nil, error);
                    });
                    return;
                }
                
                if (result.isFinal) {
                    [strongSelf stopVoiceRecognition];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        completion(result.bestTranscription.formattedString, nil);
                    });
                }
            }];
            
            // Start audio engine
            NSError *audioError = nil;
            if (![self.audioEngine startAndReturnError:&audioError]) {
                [self stopVoiceRecognition];
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(nil, audioError);
                });
                return;
            }
            
            // Update state and start timeout timer
            self.currentState = VoiceRecognitionStateListening;
            self.isProcessing = YES;
            
            [self startTimeoutTimer];
            
            // Post state change notification
            [self postStateChangeNotificationWithPreviousState:VoiceRecognitionStateIdle];
        }];
    });
}

- (void)stopVoiceRecognition {
    dispatch_async(voiceQueue, ^{
        [self.timeoutTimer invalidate];
        self.timeoutTimer = nil;
        
        VoiceRecognitionState previousState = self.currentState;
        
        [self.audioEngine stop];
        [self.audioEngine.inputNode removeTapOnBus:0];
        [self.recognitionTask cancel];
        self.recognitionTask = nil;
        
        [[AudioSessionManager sharedInstance] deactivateAudioSession];
        
        self.currentState = VoiceRecognitionStateFinished;
        self.isProcessing = NO;
        
        [self postStateChangeNotificationWithPreviousState:previousState];
    });
}

#pragma mark - State Management

- (VoiceRecognitionState)getCurrentState {
    return self.currentState;
}

- (BOOL)isAvailable {
    return [SFSpeechRecognizer authorizationStatus] == SFSpeechRecognizerAuthorizationStatusAuthorized &&
           [[PermissionManager sharedInstance] checkMicrophonePermission];
}

#pragma mark - Configuration

- (BOOL)setRecognitionLanguage:(NSString *)languageCode {
    if (!languageCode) return NO;
    
    NSLocale *locale = [NSLocale localeWithLocaleIdentifier:languageCode];
    SFSpeechRecognizer *newRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
    
    if (!newRecognizer || !newRecognizer.isAvailable) return NO;
    
    self.speechRecognizer = newRecognizer;
    self.currentLanguage = languageCode;
    return YES;
}

- (void)setRecognitionTimeout:(NSTimeInterval)timeout {
    dispatch_async(voiceQueue, ^{
        if (self.timeoutTimer) {
            [self.timeoutTimer invalidate];
        }
        if (timeout > 0) {
            self.timeoutTimer = [NSTimer scheduledTimerWithTimeInterval:timeout
                                                               target:self
                                                             selector:@selector(handleRecognitionTimeout)
                                                             userInfo:nil
                                                              repeats:NO];
        }
    });
}

#pragma mark - Private Methods

- (void)handleRecognitionTimeout {
    [self stopVoiceRecognition];
    
    NSError *timeoutError = [NSError errorWithDomain:MBVoiceRecognitionErrorDomain
                                               code:VoiceRecognitionErrorTimeout
                                           userInfo:@{NSLocalizedDescriptionKey: @"Voice recognition timed out"}];
    self.lastError = timeoutError;
    
    [[NSNotificationCenter defaultCenter] postNotificationName:MBVoiceRecognitionErrorNotification
                                                      object:self
                                                    userInfo:@{@"error": timeoutError}];
}

- (void)startTimeoutTimer {
    [self setRecognitionTimeout:kVoiceRecognitionTimeout];
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    NSInteger type = [notification.userInfo[AVAudioSessionInterruptionTypeKey] integerValue];
    
    dispatch_async(voiceQueue, ^{
        if (type == AVAudioSessionInterruptionTypeBegan) {
            [self stopVoiceRecognition];
        } else if (type == AVAudioSessionInterruptionTypeEnded) {
            // Handle interruption end if needed
        }
    });
}

- (void)postStateChangeNotificationWithPreviousState:(VoiceRecognitionState)previousState {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[NSNotificationCenter defaultCenter] postNotificationName:MBVoiceRecognitionStateDidChangeNotification
                                                          object:self
                                                        userInfo:@{
            MBVoiceRecognitionNewStateKey: @(self.currentState),
            MBVoiceRecognitionPreviousStateKey: @(previousState)
        }];
    });
}

@end