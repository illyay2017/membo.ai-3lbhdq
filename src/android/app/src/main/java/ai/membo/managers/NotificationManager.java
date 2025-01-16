package ai.membo.managers;

import android.app.NotificationChannel;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationChannelGroupCompat;
import androidx.core.app.NotificationManagerCompat;

import ai.membo.constants.ErrorCodes;
import ai.membo.utils.PermissionManager;

/**
 * Manages Android notifications for membo.ai application with support for study reminders,
 * content processing updates, and system notifications.
 * 
 * @version 1.0
 * @since 2024-01
 */
public class NotificationManager {
    private static final String TAG = "NotificationManager";

    private final Context mContext;
    private final NotificationManagerCompat mNotificationManager;

    // Notification Channel IDs
    private static final String CHANNEL_GROUP_ID = "membo_notifications";
    private static final String CHANNEL_STUDY_REMINDERS = "study_reminders";
    private static final String CHANNEL_CONTENT_UPDATES = "content_updates";
    private static final String CHANNEL_SYSTEM = "system_notifications";

    // Notification Settings
    private static final long[] VIBRATION_PATTERN_STUDY = {0, 250, 250, 250};
    private static final long[] VIBRATION_PATTERN_CONTENT = {0, 150, 150, 150};
    private static final int LED_COLOR_STUDY = Color.BLUE;
    private static final int LED_COLOR_CONTENT = Color.GREEN;
    private static final int PENDING_INTENT_FLAGS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M 
            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            : PendingIntent.FLAG_UPDATE_CURRENT;

    /**
     * Constructs a new NotificationManager instance
     * @param context The application context
     */
    public NotificationManager(@NonNull Context context) {
        mContext = context.getApplicationContext();
        mNotificationManager = NotificationManagerCompat.from(mContext);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }
    }

    /**
     * Creates notification channels for Android O and above
     */
    @RequiresApi(api = Build.VERSION_CODES.O)
    private void createNotificationChannels() {
        // Create channel group
        NotificationChannelGroupCompat group = new NotificationChannelGroupCompat.Builder(CHANNEL_GROUP_ID)
                .setName("Membo Notifications")
                .setDescription("All notifications from membo.ai")
                .build();
        mNotificationManager.createNotificationChannelGroup(group);

        // Study Reminders Channel
        NotificationChannel studyChannel = new NotificationChannel(
                CHANNEL_STUDY_REMINDERS,
                "Study Reminders",
                android.app.NotificationManager.IMPORTANCE_HIGH);
        studyChannel.setDescription("Notifications for study sessions and reminders");
        studyChannel.enableVibration(true);
        studyChannel.setVibrationPattern(VIBRATION_PATTERN_STUDY);
        studyChannel.enableLights(true);
        studyChannel.setLightColor(LED_COLOR_STUDY);
        studyChannel.setGroup(CHANNEL_GROUP_ID);
        studyChannel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());

        // Content Updates Channel
        NotificationChannel contentChannel = new NotificationChannel(
                CHANNEL_CONTENT_UPDATES,
                "Content Updates",
                android.app.NotificationManager.IMPORTANCE_DEFAULT);
        contentChannel.setDescription("Notifications for content processing and updates");
        contentChannel.enableVibration(true);
        contentChannel.setVibrationPattern(VIBRATION_PATTERN_CONTENT);
        contentChannel.enableLights(true);
        contentChannel.setLightColor(LED_COLOR_CONTENT);
        contentChannel.setGroup(CHANNEL_GROUP_ID);

        // System Notifications Channel
        NotificationChannel systemChannel = new NotificationChannel(
                CHANNEL_SYSTEM,
                "System Notifications",
                android.app.NotificationManager.IMPORTANCE_LOW);
        systemChannel.setDescription("System and service notifications");
        systemChannel.setGroup(CHANNEL_GROUP_ID);

        // Create all channels
        mNotificationManager.createNotificationChannel(studyChannel);
        mNotificationManager.createNotificationChannel(contentChannel);
        mNotificationManager.createNotificationChannel(systemChannel);
    }

    /**
     * Shows a study reminder notification
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     * @param studySession Study session details
     */
    public void showStudyReminder(String title, String message, int notificationId, StudySession studySession) {
        if (!checkNotificationPermission()) {
            return;
        }

        // Create intent for notification tap action
        Intent intent = new Intent(mContext, StudyActivity.class);
        intent.putExtra("session_id", studySession.getId());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                mContext, notificationId, intent, PENDING_INTENT_FLAGS);

        // Create quick action intents
        PendingIntent studyNowIntent = createStudyNowPendingIntent(studySession);
        PendingIntent snoozeIntent = createSnoozePendingIntent(studySession);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, CHANNEL_STUDY_REMINDERS)
                .setSmallIcon(R.drawable.ic_notification_study)
                .setContentTitle(title)
                .setContentText(message)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setContentIntent(pendingIntent)
                .setVibrate(VIBRATION_PATTERN_STUDY)
                .setLights(LED_COLOR_STUDY, 1000, 1000)
                .addAction(R.drawable.ic_study_now, "Study Now", studyNowIntent)
                .addAction(R.drawable.ic_snooze, "Snooze", snoozeIntent)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message));

        showNotification(notificationId, builder.build());
    }

    /**
     * Shows a content processing completion notification
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     * @param result Content processing result
     */
    public void showContentProcessed(String title, String message, int notificationId, 
            ContentProcessingResult result) {
        if (!checkNotificationPermission()) {
            return;
        }

        Intent intent = new Intent(mContext, ContentViewActivity.class);
        intent.putExtra("content_id", result.getContentId());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                mContext, notificationId, intent, PENDING_INTENT_FLAGS);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, CHANNEL_CONTENT_UPDATES)
                .setSmallIcon(R.drawable.ic_notification_content)
                .setContentTitle(title)
                .setContentText(message)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setContentIntent(pendingIntent)
                .setVibrate(VIBRATION_PATTERN_CONTENT)
                .setLights(LED_COLOR_CONTENT, 1000, 1000);

        if (result.hasProgress()) {
            builder.setProgress(100, result.getProgress(), false);
        }

        showNotification(notificationId, builder.build());
    }

    /**
     * Shows a system notification
     * @param title Notification title
     * @param message Notification message
     * @param notificationId Unique notification ID
     */
    public void showSystemNotification(String title, String message, int notificationId) {
        if (!checkNotificationPermission()) {
            return;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, CHANNEL_SYSTEM)
                .setSmallIcon(R.drawable.ic_notification_system)
                .setContentTitle(title)
                .setContentText(message)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SYSTEM);

        showNotification(notificationId, builder.build());
    }

    /**
     * Cancels a specific notification
     * @param notificationId The ID of the notification to cancel
     */
    public void cancelNotification(int notificationId) {
        mNotificationManager.cancel(notificationId);
    }

    /**
     * Cancels all notifications
     */
    public void cancelAllNotifications() {
        mNotificationManager.cancelAll();
    }

    private boolean checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return PermissionManager.checkStoragePermission();
        }
        return true;
    }

    private void showNotification(int notificationId, android.app.Notification notification) {
        try {
            mNotificationManager.notify(notificationId, notification);
        } catch (SecurityException e) {
            Log.e(TAG, "Failed to show notification: " + ErrorCodes.ERROR_BAD_REQUEST, e);
        }
    }

    private PendingIntent createStudyNowPendingIntent(StudySession session) {
        Intent intent = new Intent(mContext, StudyActivity.class);
        intent.putExtra("session_id", session.getId());
        intent.putExtra("start_now", true);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                mContext, (int) System.currentTimeMillis(), intent, PENDING_INTENT_FLAGS);
    }

    private PendingIntent createSnoozePendingIntent(StudySession session) {
        Intent intent = new Intent(mContext, NotificationReceiver.class);
        intent.setAction("SNOOZE_STUDY_SESSION");
        intent.putExtra("session_id", session.getId());
        return PendingIntent.getBroadcast(
                mContext, (int) System.currentTimeMillis(), intent, PENDING_INTENT_FLAGS);
    }
}