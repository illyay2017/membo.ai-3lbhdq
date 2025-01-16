package ai.membo.modules;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;

import android.os.Build;
import android.util.Log;

import ai.membo.managers.NotificationManager;
import ai.membo.managers.AnalyticsManager;
import ai.membo.constants.ErrorCodes;
import ai.membo.utils.PermissionManager;

/**
 * React Native module that provides a bridge for Android notification functionality.
 * Implements secure notification management with analytics tracking and error handling.
 * 
 * @version 1.0
 * @since 2024-01
 */
public class RNNotificationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNNotificationModule";
    private static final String MODULE_NAME = "RNNotificationModule";

    private final NotificationManager mNotificationManager;
    private final ReactApplicationContext mReactContext;
    private final AnalyticsManager mAnalyticsManager;

    /**
     * Constructs a new RNNotificationModule instance
     * @param reactContext The React Native application context
     */
    public RNNotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        mReactContext = reactContext;
        mNotificationManager = new NotificationManager(reactContext);
        mAnalyticsManager = new AnalyticsManager(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Shows a study reminder notification with analytics tracking
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     * @param studySession Study session details
     * @param promise Promise to resolve/reject the operation
     */
    @ReactMethod
    public void showStudyReminder(String title, String message, int notificationId, 
            ReadableMap studySession, Promise promise) {
        try {
            if (mReactContext == null) {
                throw new IllegalStateException("React context is null");
            }

            // Validate input parameters
            if (title == null || message == null || studySession == null) {
                promise.reject(
                    ErrorCodes.ERROR_VALIDATION,
                    "Invalid notification parameters"
                );
                return;
            }

            // Track notification attempt
            mAnalyticsManager.trackEvent("study_reminder_attempt", studySession);

            // Show notification
            mNotificationManager.showStudyReminder(
                title,
                message,
                notificationId,
                convertToStudySession(studySession)
            );

            // Track success
            mAnalyticsManager.trackEvent("study_reminder_shown", studySession);
            promise.resolve(null);

        } catch (Exception e) {
            Log.e(TAG, "Failed to show study reminder", e);
            mAnalyticsManager.trackError("study_reminder_failed", e);
            promise.reject(ErrorCodes.ERROR_INTERNAL, e.getMessage());
        }
    }

    /**
     * Shows a content processing completion notification
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     * @param result Content processing result
     * @param promise Promise to resolve/reject the operation
     */
    @ReactMethod
    public void showContentProcessed(String title, String message, int notificationId, 
            ReadableMap result, Promise promise) {
        try {
            if (mReactContext == null) {
                throw new IllegalStateException("React context is null");
            }

            // Validate input parameters
            if (title == null || message == null || result == null) {
                promise.reject(
                    ErrorCodes.ERROR_VALIDATION,
                    "Invalid notification parameters"
                );
                return;
            }

            // Track notification attempt
            mAnalyticsManager.trackEvent("content_processed_attempt", result);

            // Show notification
            mNotificationManager.showContentProcessed(
                title,
                message,
                notificationId,
                convertToContentResult(result)
            );

            // Track success
            mAnalyticsManager.trackEvent("content_processed_shown", result);
            promise.resolve(null);

        } catch (Exception e) {
            Log.e(TAG, "Failed to show content processed notification", e);
            mAnalyticsManager.trackError("content_processed_failed", e);
            promise.reject(ErrorCodes.ERROR_INTERNAL, e.getMessage());
        }
    }

    /**
     * Shows a system notification
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     * @param promise Promise to resolve/reject the operation
     */
    @ReactMethod
    public void showSystemNotification(String title, String message, int notificationId, 
            Promise promise) {
        try {
            if (mReactContext == null) {
                throw new IllegalStateException("React context is null");
            }

            // Validate input parameters
            if (title == null || message == null) {
                promise.reject(
                    ErrorCodes.ERROR_VALIDATION,
                    "Invalid notification parameters"
                );
                return;
            }

            // Track notification attempt
            mAnalyticsManager.trackEvent("system_notification_attempt");

            // Show notification
            mNotificationManager.showSystemNotification(title, message, notificationId);

            // Track success
            mAnalyticsManager.trackEvent("system_notification_shown");
            promise.resolve(null);

        } catch (Exception e) {
            Log.e(TAG, "Failed to show system notification", e);
            mAnalyticsManager.trackError("system_notification_failed", e);
            promise.reject(ErrorCodes.ERROR_INTERNAL, e.getMessage());
        }
    }

    /**
     * Cancels a specific notification
     * @param notificationId The ID of the notification to cancel
     * @param promise Promise to resolve/reject the operation
     */
    @ReactMethod
    public void cancelNotification(int notificationId, Promise promise) {
        try {
            mNotificationManager.cancelNotification(notificationId);
            mAnalyticsManager.trackEvent("notification_cancelled");
            promise.resolve(null);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel notification", e);
            mAnalyticsManager.trackError("notification_cancel_failed", e);
            promise.reject(ErrorCodes.ERROR_INTERNAL, e.getMessage());
        }
    }

    /**
     * Cancels all notifications
     * @param promise Promise to resolve/reject the operation
     */
    @ReactMethod
    public void cancelAllNotifications(Promise promise) {
        try {
            mNotificationManager.cancelAllNotifications();
            mAnalyticsManager.trackEvent("all_notifications_cancelled");
            promise.resolve(null);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel all notifications", e);
            mAnalyticsManager.trackError("notification_cancel_all_failed", e);
            promise.reject(ErrorCodes.ERROR_INTERNAL, e.getMessage());
        }
    }

    /**
     * Converts a ReadableMap to StudySession object
     */
    private StudySession convertToStudySession(ReadableMap map) {
        StudySession session = new StudySession();
        session.setId(map.getString("id"));
        // Add other relevant session data
        return session;
    }

    /**
     * Converts a ReadableMap to ContentProcessingResult object
     */
    private ContentProcessingResult convertToContentResult(ReadableMap map) {
        ContentProcessingResult result = new ContentProcessingResult();
        result.setContentId(map.getString("contentId"));
        if (map.hasKey("progress")) {
            result.setProgress(map.getInt("progress"));
        }
        // Add other relevant result data
        return result;
    }
}