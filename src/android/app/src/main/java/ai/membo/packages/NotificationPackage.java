package ai.membo.packages;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.logging.Logger;
import java.util.logging.Level;

import ai.membo.modules.RNNotificationModule;
import ai.membo.constants.ErrorCodes;

/**
 * React Native package that provides notification functionality to the JavaScript runtime
 * with enhanced error handling, performance monitoring, and security features.
 * 
 * Implements study engagement notifications and content processing updates as per
 * technical specifications section 1.2 SUCCESS CRITERIA.
 * 
 * @version 1.0
 * @since 2024-01
 */
public class NotificationPackage implements ReactPackage {
    private static final Logger LOGGER = Logger.getLogger(NotificationPackage.class.getName());
    private static final String TAG = "NotificationPackage";
    private final MetricsCollector metricsCollector;

    /**
     * Constructs a new NotificationPackage instance with metrics initialization
     */
    public NotificationPackage() {
        LOGGER.setLevel(Level.INFO);
        this.metricsCollector = new MetricsCollector();
        configureMetrics();
    }

    /**
     * Creates and returns a list of native modules to register with React Native
     * with enhanced error handling and monitoring
     *
     * @param reactContext The React Native application context
     * @return List containing the RNNotificationModule instance
     * @throws IllegalStateException if reactContext is null
     */
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        long startTime = System.currentTimeMillis();
        List<NativeModule> modules = new ArrayList<>();

        try {
            if (reactContext == null) {
                throw new IllegalStateException(ErrorCodes.ERROR_BAD_REQUEST);
            }

            // Create and validate notification module
            RNNotificationModule notificationModule = new RNNotificationModule(reactContext);
            validateModuleInitialization(notificationModule);

            // Record memory usage metrics
            metricsCollector.recordMemoryUsage("notification_module_init");

            // Add module to list
            modules.add(notificationModule);

            LOGGER.info("Successfully created RNNotificationModule");
            recordMetrics(startTime);

            return modules;

        } catch (Exception e) {
            LOGGER.severe("Failed to create native modules: " + e.getMessage());
            metricsCollector.recordError("module_creation_failed", e);
            throw new RuntimeException("Module initialization failed", e);
        }
    }

    /**
     * Creates and returns a list of view managers (empty as this package has no UI components)
     *
     * @param reactContext The React Native application context
     * @return Empty list as no view managers are needed
     */
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    /**
     * Validates the initialization of the notification module
     *
     * @param module The notification module to validate
     * @throws IllegalStateException if module validation fails
     */
    private void validateModuleInitialization(RNNotificationModule module) {
        if (module == null || module.getName() == null) {
            LOGGER.severe("Invalid module initialization");
            throw new IllegalStateException("Module validation failed");
        }
    }

    /**
     * Records metrics for module creation performance
     *
     * @param startTime The start time of module creation
     */
    private void recordMetrics(long startTime) {
        long duration = System.currentTimeMillis() - startTime;
        metricsCollector.recordLatency("module_creation", duration);
    }

    /**
     * Configures metrics collection settings
     */
    private void configureMetrics() {
        metricsCollector.setEnabled(true);
        metricsCollector.setTag("package", "notification");
        metricsCollector.initialize();
    }
}