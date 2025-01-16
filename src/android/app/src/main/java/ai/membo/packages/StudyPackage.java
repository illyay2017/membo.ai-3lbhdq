package ai.membo.packages;

import androidx.annotation.NonNull; // Version: 1.6.0
import com.facebook.react.ReactPackage; // Version: 0.72.x
import com.facebook.react.bridge.NativeModule; // Version: 0.72.x
import com.facebook.react.bridge.ReactApplicationContext; // Version: 0.72.x
import com.facebook.react.uimanager.ViewManager; // Version: 0.72.x

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import ai.membo.modules.RNStudyModule;

/**
 * React Native package implementation that registers the study module for native Android functionality.
 * Provides optimized initialization and resource management for study features including:
 * - FSRS algorithm implementation
 * - Study session management
 * - Voice-enabled study mode
 * - Quiz mode
 *
 * @version 1.0
 * @since 2024-01
 */
public class StudyPackage implements ReactPackage {

    /**
     * Default constructor with minimal initialization overhead.
     * Defers all resource allocation to module creation time.
     */
    public StudyPackage() {
        // Empty constructor - no initialization needed
    }

    /**
     * Creates and returns a list of native modules for React Native.
     * Optimized for single module registration with minimal allocation.
     *
     * @param reactContext The React Native application context
     * @return List containing single RNStudyModule instance
     */
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>(1); // Pre-sized for efficiency
        modules.add(new RNStudyModule(reactContext));
        return modules;
    }

    /**
     * Creates and returns an empty list of view managers.
     * Optimized to return immutable empty list since no view managers are needed.
     *
     * @param reactContext The React Native application context
     * @return Empty immutable list
     */
    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList(); // Zero allocation for unused view managers
    }
}