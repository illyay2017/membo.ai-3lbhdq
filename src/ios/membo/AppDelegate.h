// UIKit version: iOS SDK 12.0+
#import <UIKit/UIKit.h>
// React Native iOS SDK
#import <React/React.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Main application delegate class for membo.ai iOS app.
 * Handles application lifecycle events, React Native bridge initialization,
 * and voice processing capabilities setup.
 */
@interface AppDelegate : UIResponder <UIApplicationDelegate, RCTBridgeDelegate>

/**
 * The main window of the application.
 * Required for iOS app UI presentation.
 */
@property (nonatomic, strong) UIWindow *window;

/**
 * React Native bridge instance.
 * Manages communication between native and JavaScript code.
 */
@property (nonatomic, strong) RCTBridge *bridge;

/**
 * Provides the location of the JavaScript bundle for React Native.
 * Implementation of RCTBridgeDelegate protocol.
 *
 * @param bridge The React Native bridge instance requesting the bundle URL
 * @return NSURL pointing to the JavaScript bundle location
 */
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge;

@end

NS_ASSUME_NONNULL_END