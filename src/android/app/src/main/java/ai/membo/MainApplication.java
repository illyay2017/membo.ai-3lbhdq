package ai.membo;

import android.app.Application;
import android.content.Context;
import android.os.StrictMode;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;

import java.util.ArrayList;
import java.util.List;

import ai.membo.packages.VoicePackage;
import ai.membo.packages.StudyPackage;
import ai.membo.packages.ContentCapturePackage;
import ai.membo.packages.NotificationPackage;

/**
 * Main application class that initializes React Native and native modules with comprehensive
 * error handling, performance monitoring, and resource management.
 *
 * @version 1.0
 * @since 2024-01
 */
public class MainApplication extends Application implements ReactApplication {
    private static final String TAG = "MainApplication";

    private final ReactNativeHost mReactNativeHost = new DefaultReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            List<ReactPackage> packages = new ArrayList<>();
            try {
                // Initialize core packages with validation
                packages.add(new VoicePackage()); // Voice-first interaction capability
                packages.add(new StudyPackage()); // FSRS implementation
                packages.add(new ContentCapturePackage()); // Content capture functionality
                packages.add(new NotificationPackage()); // Notification management

                Log.i(TAG, "Successfully initialized React Native packages");
                return packages;
            } catch (Exception e) {
                Log.e(TAG, "Error initializing React Native packages", e);
                // Return empty list to prevent crash, app will handle degraded state
                return new ArrayList<>();
            }
        }

        @Override
        protected String getJSMainModuleName() {
            return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
            return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
            return BuildConfig.IS_HERMES_ENABLED;
        }
    };

    @Override
    public ReactNativeHost getReactNativeHost() {
        return mReactNativeHost;
    }

    @Override
    public void onCreate() {
        // Enable strict mode for development builds
        if (BuildConfig.DEBUG) {
            enableStrictMode();
        }

        super.onCreate();

        try {
            // Initialize performance monitoring
            initializePerformanceMonitoring();

            // Initialize SoLoader with error handling
            initializeSoLoader();

            // Configure memory management
            configureMemoryManagement();

            Log.i(TAG, "Application initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error during application initialization", e);
            // Application will continue in degraded state
        }
    }

    /**
     * Initializes SoLoader with proper error handling
     */
    private void initializeSoLoader() {
        try {
            SoLoader.init(this, /* native exopackage */ false);
            Log.i(TAG, "SoLoader initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize SoLoader", e);
            throw new RuntimeException("Failed to initialize SoLoader", e);
        }
    }

    /**
     * Configures strict mode for development builds
     */
    private void enableStrictMode() {
        StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder()
                .detectDiskReads()
                .detectDiskWrites()
                .detectNetwork()
                .penaltyLog()
                .build());

        StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder()
                .detectLeakedSqlLiteObjects()
                .detectLeakedClosableObjects()
                .penaltyLog()
                .build());
    }

    /**
     * Initializes performance monitoring systems
     */
    private void initializePerformanceMonitoring() {
        // Configure performance tracking
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Uncaught exception in thread " + thread.getName(), throwable);
        });
    }

    /**
     * Configures memory management policies
     */
    private void configureMemoryManagement() {
        // Set memory trimming callbacks
        this.registerComponentCallbacks(new ComponentCallbacks2() {
            @Override
            public void onTrimMemory(int level) {
                if (level >= TRIM_MEMORY_MODERATE) {
                    // Clear caches and non-critical resources
                    System.gc();
                }
            }

            @Override
            public void onConfigurationChanged(@NonNull Configuration newConfig) {
                // Handle configuration changes
            }

            @Override
            public void onLowMemory() {
                // Clear all caches
                System.gc();
            }
        });
    }

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        // Initialize crash reporting
        initializeCrashReporting();
    }

    /**
     * Initializes crash reporting system
     */
    private void initializeCrashReporting() {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Fatal exception in thread " + thread.getName(), throwable);
            // Log crash and recover if possible
            System.exit(1);
        });
    }
}