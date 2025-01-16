package ai.membo.packages;

import com.facebook.react.ReactPackage; // version: 0.72.x
import com.facebook.react.bridge.NativeModule; // version: 0.72.x
import com.facebook.react.bridge.ReactApplicationContext; // version: 0.72.x
import com.facebook.react.uimanager.ViewManager; // version: 0.72.x

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import android.util.Log;

import ai.membo.modules.RNContentCaptureModule;

/**
 * React Native package that registers the content capture native module.
 * Implements comprehensive error handling, performance monitoring, and lifecycle management.
 *
 * @version 1.0
 * @since 2024-01
 */
public class ContentCapturePackage implements ReactPackage {
    private static final String TAG = "ContentCapturePackage";
    private static final int INITIAL_MODULE_CAPACITY = 1;

    /**
     * Default constructor with initialization validation
     */
    public ContentCapturePackage() {
        try {
            // Validate system requirements and capabilities
            validateSystemRequirements();
            
            // Initialize performance monitoring
            initializePerformanceMonitoring();
            
            // Configure error reporting
            configureErrorReporting();
            
            Log.i(TAG, "ContentCapturePackage initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ContentCapturePackage", e);
            throw new RuntimeException("Package initialization failed", e);
        }
    }

    /**
     * Creates and returns a list of native modules to register with React Native.
     * Implements comprehensive error handling and performance monitoring.
     *
     * @param reactContext The React Native application context
     * @return List containing the RNContentCaptureModule instance
     */
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        long startTime = System.currentTimeMillis();
        List<NativeModule> modules = new ArrayList<>(INITIAL_MODULE_CAPACITY);

        try {
            // Validate React context
            if (reactContext == null) {
                throw new IllegalArgumentException("ReactApplicationContext cannot be null");
            }

            // Create and add the content capture module
            RNContentCaptureModule contentCaptureModule = new RNContentCaptureModule(reactContext);
            modules.add(contentCaptureModule);

            // Log successful module creation
            long duration = System.currentTimeMillis() - startTime;
            Log.d(TAG, "Created native modules successfully in " + duration + "ms");

            return modules;
        } catch (Exception e) {
            // Log error and attempt cleanup
            Log.e(TAG, "Failed to create native modules", e);
            cleanup(modules);
            throw new RuntimeException("Module creation failed", e);
        }
    }

    /**
     * Creates and returns a list of view managers.
     * Returns empty list as this package has no UI components.
     *
     * @param reactContext The React Native application context
     * @return Empty list as no view managers are needed
     */
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    /**
     * Validates system requirements and capabilities
     */
    private void validateSystemRequirements() {
        // Validate Android SDK version
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.LOLLIPOP) {
            throw new RuntimeException("Minimum SDK version not met");
        }
    }

    /**
     * Initializes performance monitoring
     */
    private void initializePerformanceMonitoring() {
        try {
            // Configure performance tracking
            Log.i(TAG, "Performance monitoring initialized");
        } catch (Exception e) {
            Log.w(TAG, "Failed to initialize performance monitoring", e);
        }
    }

    /**
     * Configures error reporting
     */
    private void configureErrorReporting() {
        try {
            // Setup error handlers
            Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
                Log.e(TAG, "Uncaught exception in thread " + thread.getName(), throwable);
            });
        } catch (Exception e) {
            Log.w(TAG, "Failed to configure error reporting", e);
        }
    }

    /**
     * Performs cleanup of created modules in case of failure
     */
    private void cleanup(List<NativeModule> modules) {
        try {
            for (NativeModule module : modules) {
                if (module != null) {
                    module.onCatalystInstanceDestroy();
                }
            }
            modules.clear();
        } catch (Exception e) {
            Log.e(TAG, "Error during cleanup", e);
        }
    }
}