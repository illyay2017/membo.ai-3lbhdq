package ai.membo.modules;

import android.os.Handler;
import android.os.PowerManager;
import android.content.Context;
import android.util.Log;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import ai.membo.managers.VoiceManager;
import ai.membo.constants.VoiceConstants;
import ai.membo.utils.AudioSessionManager;
import ai.membo.utils.PermissionManager;

/**
 * React Native module that provides voice recognition capabilities to JavaScript.
 * Implements voice-first interaction design with enhanced error handling and resource management.
 *
 * @version 1.0
 * @since 2024-01
 */
public class RNVoiceModule extends ReactContextBaseJavaModule implements VoiceManager.VoiceRecognitionCallback {
    private static final String TAG = "RNVoiceModule";
    private static final String MODULE_NAME = "RNVoiceModule";
    private static final long WAKE_LOCK_TIMEOUT = 30000; // 30 seconds

    private final VoiceManager mVoiceManager;
    private final ReactApplicationContext mReactContext;
    private PowerManager.WakeLock mWakeLock;
    private final Handler mHandler;
    private boolean mIsInitialized = false;

    public RNVoiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        mReactContext = reactContext;
        
        // Initialize managers
        AudioSessionManager audioSessionManager = new AudioSessionManager(reactContext);
        PermissionManager permissionManager = new PermissionManager(getCurrentActivity(), 
            new PermissionManager.PermissionCallback() {
                @Override
                public void onPermissionGranted(String permission) {
                    sendEvent("onPermissionGranted", null);
                }

                @Override
                public void onPermissionDenied(String permission, boolean shouldShowRationale) {
                    WritableMap params = new WritableNativeMap();
                    params.putBoolean("shouldShowRationale", shouldShowRationale);
                    sendEvent("onPermissionDenied", params);
                }
            });

        mVoiceManager = new VoiceManager(reactContext, audioSessionManager, permissionManager);
        mHandler = new Handler();

        // Initialize wake lock
        PowerManager powerManager = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
        mWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, 
            "membo:VoiceRecognitionWakeLock");
        
        mIsInitialized = true;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Starts voice recognition with enhanced error handling
     */
    @ReactMethod
    public void startVoiceRecognition(final Promise promise) {
        if (!mIsInitialized) {
            promise.reject("NOT_INITIALIZED", "Voice module not properly initialized");
            return;
        }

        try {
            // Acquire wake lock
            if (!mWakeLock.isHeld()) {
                mWakeLock.acquire(WAKE_LOCK_TIMEOUT);
            }

            boolean started = mVoiceManager.startVoiceRecognition(this);
            if (started) {
                promise.resolve(null);
            } else {
                promise.reject("START_FAILED", "Failed to start voice recognition");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting voice recognition", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Stops voice recognition and releases resources
     */
    @ReactMethod
    public void stopVoiceRecognition(final Promise promise) {
        try {
            mVoiceManager.stopVoiceRecognition();
            
            // Release wake lock if held
            if (mWakeLock.isHeld()) {
                mWakeLock.release();
            }
            
            promise.resolve(null);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping voice recognition", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Gets current voice recognition state
     */
    @ReactMethod
    public void getRecognitionState(final Promise promise) {
        try {
            @VoiceConstants.VoiceRecognitionState int state = mVoiceManager.getCurrentState();
            WritableMap stateMap = new WritableNativeMap();
            stateMap.putInt("state", state);
            promise.resolve(stateMap);
        } catch (Exception e) {
            Log.e(TAG, "Error getting recognition state", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    // VoiceRecognitionCallback Implementation

    @Override
    public void onRecognitionStarted() {
        sendEvent("onRecognitionStarted", null);
    }

    @Override
    public void onRecognitionResult(String result, float confidence) {
        WritableMap params = new WritableNativeMap();
        params.putString("result", result);
        params.putDouble("confidence", confidence);
        sendEvent("onRecognitionResult", params);
    }

    @Override
    public void onRecognitionError(@VoiceConstants.VoiceRecognitionError int errorCode) {
        WritableMap params = new WritableNativeMap();
        params.putInt("errorCode", errorCode);
        sendEvent("onRecognitionError", params);
    }

    @Override
    public void onRecognitionEnded() {
        sendEvent("onRecognitionEnded", null);
    }

    /**
     * Sends events to JavaScript
     */
    private void sendEvent(String eventName, WritableMap params) {
        try {
            mReactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending event " + eventName, e);
        }
    }

    /**
     * Called on module destroy
     */
    @Override
    public void onCatalystInstanceDestroy() {
        try {
            mVoiceManager.stopVoiceRecognition();
            if (mWakeLock.isHeld()) {
                mWakeLock.release();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up voice module", e);
        }
        super.onCatalystInstanceDestroy();
    }
}