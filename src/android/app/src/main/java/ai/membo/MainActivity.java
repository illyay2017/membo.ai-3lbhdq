package ai.membo;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.SpeechRecognizer;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.ReactActivity;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.ReactActivityDelegate;

import ai.membo.managers.StudyManager;
import ai.membo.managers.VoiceManager;
import ai.membo.utils.PermissionManager;
import ai.membo.constants.StudyModes;

/**
 * Main activity class for the membo.ai Android application.
 * Serves as the primary entry point and container for the React Native application,
 * handling lifecycle events, voice recognition initialization, and study mode configuration.
 *
 * @version 1.0
 * @since 2024-01
 */
public class MainActivity extends ReactActivity {
    private static final String TAG = "MainActivity";
    private static final int PERMISSION_REQUEST_CODE = 100;

    private SpeechRecognizer speechRecognizer;
    private VoiceManager voiceManager;
    private StudyManager studyManager;
    private PermissionManager permissionManager;
    private boolean isVoiceModeEnabled = false;

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "membo";
    }

    /**
     * Creates an enhanced React Native activity delegate with voice and study support.
     */
    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            // If you opted-in for the New Architecture, we enable the Fabric Renderer.
            getReactNativeHost().getReactInstanceManager()
        );
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize permission manager
        permissionManager = new PermissionManager(this, new PermissionManager.PermissionCallback() {
            @Override
            public void onPermissionGranted(String permission) {
                if (permission.equals(Manifest.permission.RECORD_AUDIO)) {
                    initializeVoiceRecognition();
                }
            }

            @Override
            public void onPermissionDenied(String permission, boolean shouldShowRationale) {
                Log.w(TAG, "Permission denied: " + permission);
                if (permission.equals(Manifest.permission.RECORD_AUDIO)) {
                    isVoiceModeEnabled = false;
                }
            }
        });

        // Check and request voice permissions
        if (permissionManager.checkMicrophonePermission()) {
            initializeVoiceRecognition();
        } else {
            permissionManager.requestMicrophonePermission();
        }

        // Initialize managers
        initializeManagers();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, 
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        permissionManager.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onDestroy() {
        cleanupResources();
        super.onDestroy();
    }

    /**
     * Initializes voice recognition system
     */
    private void initializeVoiceRecognition() {
        try {
            if (SpeechRecognizer.isRecognitionAvailable(this)) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
                voiceManager = new VoiceManager(
                    this,
                    new AudioSessionManager(this),
                    permissionManager
                );
                isVoiceModeEnabled = true;
                Log.i(TAG, "Voice recognition initialized successfully");
            } else {
                Log.w(TAG, "Voice recognition not available on this device");
                isVoiceModeEnabled = false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize voice recognition", e);
            isVoiceModeEnabled = false;
        }
    }

    /**
     * Initializes study and analytics managers
     */
    private void initializeManagers() {
        try {
            // Initialize study manager with voice support
            studyManager = new StudyManager(
                this,
                voiceManager,
                new FSRSParameters(),
                new StudyAnalytics()
            );

            Log.i(TAG, "Managers initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize managers", e);
        }
    }

    /**
     * Cleans up resources when activity is destroyed
     */
    private void cleanupResources() {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
                speechRecognizer = null;
            }

            if (voiceManager != null) {
                voiceManager.stopVoiceRecognition();
            }

            if (studyManager != null) {
                studyManager.endStudySession();
            }

            Log.i(TAG, "Resources cleaned up successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up resources", e);
        }
    }
}