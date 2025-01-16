package ai.membo;

import android.app.NotificationChannel;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import ai.membo.managers.NotificationManager;
import ai.membo.constants.ErrorCodes;
import ai.membo.utils.PermissionManager;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Comprehensive instrumentation test suite for NotificationManager functionality.
 * Tests notification display, channels, and management across different Android versions.
 */
@RunWith(AndroidJUnit4.class)
public class NotificationManagerTest {
    private static final String TAG = "NotificationManagerTest";
    private static final int TEST_NOTIFICATION_ID = 1000;
    private static final int TEST_CONTENT_ID = 2000;
    private static final int TEST_SYSTEM_ID = 3000;

    private NotificationManager notificationManager;
    private Context context;
    private NotificationManagerCompat notificationManagerCompat;

    @Before
    public void setUp() {
        // Get instrumentation context
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        notificationManager = new NotificationManager(context);
        notificationManagerCompat = NotificationManagerCompat.from(context);

        // Ensure notifications are enabled for tests
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            assertTrue("Notification permission required for tests", 
                PermissionManager.checkStoragePermission());
        }

        // Clear any existing notifications
        notificationManager.cancelAllNotifications();
    }

    @Test
    public void testShowStudyReminder() {
        // Create test study session data
        StudySession testSession = new StudySession.Builder()
            .setId("test_session_123")
            .setTitle("Test Study Session")
            .setDueTime(System.currentTimeMillis() + 3600000)
            .build();

        // Verify study reminder channel exists
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManagerCompat
                .getNotificationChannel("study_reminders");
            assertNotNull("Study reminder channel should exist", channel);
            assertEquals("Channel importance should be high", 
                NotificationManagerCompat.IMPORTANCE_HIGH, channel.getImportance());
        }

        // Show study reminder notification
        notificationManager.showStudyReminder(
            "Time to Study",
            "Your daily Spanish review is due",
            TEST_NOTIFICATION_ID,
            testSession
        );

        // Verify notification is displayed
        assertTrue("Study reminder should be visible", 
            isNotificationVisible(TEST_NOTIFICATION_ID));

        // Clean up
        notificationManager.cancelNotification(TEST_NOTIFICATION_ID);
    }

    @Test
    public void testShowContentProcessed() {
        // Create test content processing result
        ContentProcessingResult result = new ContentProcessingResult.Builder()
            .setContentId("content_456")
            .setProgress(100)
            .setCardsGenerated(5)
            .build();

        // Verify content updates channel exists
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManagerCompat
                .getNotificationChannel("content_updates");
            assertNotNull("Content updates channel should exist", channel);
            assertEquals("Channel importance should be default", 
                NotificationManagerCompat.IMPORTANCE_DEFAULT, channel.getImportance());
        }

        // Show content processed notification
        notificationManager.showContentProcessed(
            "Content Processed",
            "5 new cards created from your content",
            TEST_CONTENT_ID,
            result
        );

        // Verify notification is displayed
        assertTrue("Content processed notification should be visible", 
            isNotificationVisible(TEST_CONTENT_ID));

        // Clean up
        notificationManager.cancelNotification(TEST_CONTENT_ID);
    }

    @Test
    public void testShowSystemNotification() {
        // Verify system notification channel exists
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManagerCompat
                .getNotificationChannel("system_notifications");
            assertNotNull("System notification channel should exist", channel);
            assertEquals("Channel importance should be low", 
                NotificationManagerCompat.IMPORTANCE_LOW, channel.getImportance());
        }

        // Show system notification
        notificationManager.showSystemNotification(
            "System Update",
            "Application updated to latest version",
            TEST_SYSTEM_ID
        );

        // Verify notification is displayed
        assertTrue("System notification should be visible", 
            isNotificationVisible(TEST_SYSTEM_ID));

        // Clean up
        notificationManager.cancelNotification(TEST_SYSTEM_ID);
    }

    @Test
    public void testCancelNotification() {
        // Show multiple notifications
        notificationManager.showSystemNotification(
            "Test 1", "Message 1", TEST_NOTIFICATION_ID);
        notificationManager.showSystemNotification(
            "Test 2", "Message 2", TEST_CONTENT_ID);

        // Verify both notifications are displayed
        assertTrue(isNotificationVisible(TEST_NOTIFICATION_ID));
        assertTrue(isNotificationVisible(TEST_CONTENT_ID));

        // Cancel specific notification
        notificationManager.cancelNotification(TEST_NOTIFICATION_ID);

        // Verify correct notification was cancelled
        assertFalse(isNotificationVisible(TEST_NOTIFICATION_ID));
        assertTrue(isNotificationVisible(TEST_CONTENT_ID));

        // Clean up
        notificationManager.cancelNotification(TEST_CONTENT_ID);
    }

    @Test
    public void testCancelAllNotifications() {
        // Show multiple notifications
        notificationManager.showSystemNotification(
            "Test 1", "Message 1", TEST_NOTIFICATION_ID);
        notificationManager.showSystemNotification(
            "Test 2", "Message 2", TEST_CONTENT_ID);
        notificationManager.showSystemNotification(
            "Test 3", "Message 3", TEST_SYSTEM_ID);

        // Verify all notifications are displayed
        assertTrue(isNotificationVisible(TEST_NOTIFICATION_ID));
        assertTrue(isNotificationVisible(TEST_CONTENT_ID));
        assertTrue(isNotificationVisible(TEST_SYSTEM_ID));

        // Cancel all notifications
        notificationManager.cancelAllNotifications();

        // Verify all notifications are cancelled
        assertFalse(isNotificationVisible(TEST_NOTIFICATION_ID));
        assertFalse(isNotificationVisible(TEST_CONTENT_ID));
        assertFalse(isNotificationVisible(TEST_SYSTEM_ID));
    }

    /**
     * Helper method to check if a notification is visible
     * @param notificationId The notification ID to check
     * @return true if notification is visible, false otherwise
     */
    private boolean isNotificationVisible(int notificationId) {
        android.service.notification.StatusBarNotification[] notifications = 
            notificationManagerCompat.getActiveNotifications();
        
        for (android.service.notification.StatusBarNotification notification : notifications) {
            if (notification.getId() == notificationId) {
                return true;
            }
        }
        return false;
    }
}