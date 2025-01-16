package ai.membo.packages;

import androidx.annotation.NonNull;
import android.util.Log;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import ai.membo.modules.RNVoiceModule;

/**
 * React Native package that registers the voice recognition native module.
 * Provides voice-first interaction capabilities with comprehensive error handling,
 * lifecycle management, and performance optimization.
 *
 * @version 1.0
 * @since 2024-01
 */
public class VoicePackage implements ReactPackage {
    private static final String TAG = "VoicePackage";
    private static final int INITIAL_MODULE_CAPACITY = 1; // Optimized capacity for single module

    /**
     * Creates and returns a list of native modules to register with the React Native bridge.
     * Implements enhanced error handling and performance optimization.
     *
     * @param reactContext The React Native application context
     * @return List containing the RNVoiceModule instance
     * @throws IllegalArgumentException if reactContext is null
     */
    @Override
    @NonNull
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        if (reactContext == null) {
            Log.e(TAG, "ReactApplicationContext cannot be null");
            throw new IllegalArgumentException("ReactApplicationContext cannot be null");
        }

        try {
            // Initialize with optimized capacity
            List<NativeModule> modules = new ArrayList<>(INITIAL_MODULE_CAPACITY);
            
            // Create voice module instance with error handling
            RNVoiceModule voiceModule = new RNVoiceModule(reactContext);
            modules.add(voiceModule);
            
            Log.d(TAG, "Voice module created successfully");
            return Collections.unmodifiableList(modules);

        } catch (Exception e) {
            Log.e(TAG, "Error creating native modules", e);
            // Return empty list instead of null to maintain contract
            return Collections.emptyList();
        }
    }

    /**
     * Creates and returns a list of view managers.
     * Returns empty list as no view managers are needed for voice functionality.
     *
     * @param reactContext The React Native application context
     * @return Empty list as no view managers are required
     */
    @Override
    @NonNull
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        if (reactContext == null) {
            Log.e(TAG, "ReactApplicationContext cannot be null");
            throw new IllegalArgumentException("ReactApplicationContext cannot be null");
        }

        // Return immutable empty list as no view managers are needed
        return Collections.emptyList();
    }
}