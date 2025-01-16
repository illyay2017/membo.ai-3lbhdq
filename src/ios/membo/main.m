#import <UIKit/UIKit.h>
#import "AppDelegate.h"
#import <os/log.h>

// Environment configuration
NSString *const AppEnvironment = @"production";
BOOL const EnableVoiceProcessing = YES;

// Logging subsystem identifier
static NSString *const LogSubsystem = @"ai.membo.app";

/**
 * Main entry point for membo.ai iOS application.
 * Initializes core application components and establishes the runtime environment.
 *
 * @param argc Argument count from system
 * @param argv Array of argument strings
 * @return Application exit status code
 */
int main(int argc, char *argv[]) {
    // Initialize autorelease pool for memory management
    @autoreleasepool {
        // Configure logging system
        os_log_t appLog = os_log_create(LogSubsystem.UTF8String, "main");
        os_log(appLog, "membo.ai application starting in %{public}@ environment", AppEnvironment);
        
        // Configure exception handling
        NSSetUncaughtExceptionHandler(&uncaughtExceptionHandler);
        
        // Initialize performance monitoring
        CFAbsoluteTime startTime = CFAbsoluteTimeGetCurrent();
        
        @try {
            // Initialize voice processing if enabled
            if (EnableVoiceProcessing) {
                os_log(appLog, "Initializing voice processing capabilities");
                
                // Ensure audio session category is properly configured
                NSError *audioError = nil;
                [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayAndRecord
                                                     error:&audioError];
                if (audioError) {
                    os_log_error(appLog, "Failed to configure audio session: %{public}@",
                               audioError.localizedDescription);
                }
            }
            
            // Start the application with AppDelegate
            int retVal = UIApplicationMain(argc, argv, nil, NSStringFromClass([AppDelegate class]));
            
            // Log startup performance metrics
            CFAbsoluteTime launchDuration = CFAbsoluteTimeGetCurrent() - startTime;
            os_log(appLog, "Application launched in %f seconds", launchDuration);
            
            return retVal;
        }
        @catch (NSException *exception) {
            os_log_fault(appLog, "Fatal exception during app launch: %{public}@\n%{public}@",
                        exception.name, exception.reason);
            return -1;
        }
    }
}

/**
 * Handler for uncaught exceptions to ensure proper logging before crash.
 *
 * @param exception The uncaught exception
 */
void uncaughtExceptionHandler(NSException *exception) {
    os_log_t crashLog = os_log_create(LogSubsystem.UTF8String, "crash");
    os_log_fault(crashLog, "Uncaught exception: %{public}@\nStack trace: %{public}@",
                 exception.reason, [exception.callStackSymbols componentsJoinedByString:@"\n"]);
}