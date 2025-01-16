package ai.membo;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import static org.mockito.Mockito.*;
import static org.junit.Assert.*;

import ai.membo.managers.VoiceManager;
import ai.membo.constants.VoiceConstants;
import ai.membo.utils.AudioSessionManager;
import ai.membo.utils.PermissionManager;

/**
 * Comprehensive instrumentation test suite for VoiceManager.
 * Validates voice recognition functionality, error handling, state management,
 * and resource lifecycle management.
 *
 * @version 1.0
 * @since 2024-01
 */
@RunWith(AndroidJUnit4.class)
public class VoiceManagerTest {

    private VoiceManager voiceManager;
    private Context context;

    @Mock private AudioSessionManager audioSessionManager;
    @Mock private PermissionManager permissionManager;
    @Mock private VoiceManager.VoiceRecognitionCallback callback;

    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        
        // Set up default mock behaviors
        when(audioSessionManager.isSessionActive()).thenReturn(false);
        when(permissionManager.checkMicrophonePermission()).thenReturn(true);
        
        voiceManager = new VoiceManager(context, audioSessionManager, permissionManager);
    }

    @Test
    public void testStartVoiceRecognition_Success() {
        // Arrange
        when(permissionManager.checkMicrophonePermission()).thenReturn(true);
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);

        // Act
        boolean result = voiceManager.startVoiceRecognition(callback);

        // Assert
        assertTrue("Voice recognition should start successfully", result);
        assertEquals("State should be LISTENING", VoiceConstants.STATE_LISTENING, voiceManager.getCurrentState());
        verify(audioSessionManager).initializeAudioSession();
        verify(callback).onRecognitionStarted();
        verify(callback, never()).onRecognitionError(anyInt());
    }

    @Test
    public void testStartVoiceRecognition_NoPermission() {
        // Arrange
        when(permissionManager.checkMicrophonePermission()).thenReturn(false);

        // Act
        boolean result = voiceManager.startVoiceRecognition(callback);

        // Assert
        assertFalse("Voice recognition should fail without permission", result);
        assertEquals("State should be ERROR", VoiceConstants.STATE_ERROR, voiceManager.getCurrentState());
        verify(callback).onRecognitionError(VoiceConstants.ERROR_NO_PERMISSION);
        verify(permissionManager).requestMicrophonePermission();
        verify(audioSessionManager, never()).initializeAudioSession();
    }

    @Test
    public void testStartVoiceRecognition_AudioSessionFailure() {
        // Arrange
        when(permissionManager.checkMicrophonePermission()).thenReturn(true);
        when(audioSessionManager.initializeAudioSession()).thenReturn(false);

        // Act
        boolean result = voiceManager.startVoiceRecognition(callback);

        // Assert
        assertFalse("Voice recognition should fail with audio session failure", result);
        assertEquals("State should be ERROR", VoiceConstants.STATE_ERROR, voiceManager.getCurrentState());
        verify(callback).onRecognitionError(VoiceConstants.ERROR_AUDIO_SESSION);
    }

    @Test
    public void testStopVoiceRecognition() {
        // Arrange
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);
        voiceManager.startVoiceRecognition(callback);

        // Act
        voiceManager.stopVoiceRecognition();

        // Assert
        assertEquals("State should be IDLE", VoiceConstants.STATE_IDLE, voiceManager.getCurrentState());
        verify(audioSessionManager).releaseAudioSession();
        verify(callback).onRecognitionEnded();
    }

    @Test
    public void testVoiceRecognitionTimeout() throws InterruptedException {
        // Arrange
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);
        voiceManager.startVoiceRecognition(callback);

        // Act
        Thread.sleep(VoiceConstants.VOICE_RECOGNITION_TIMEOUT_MS + 100);

        // Assert
        assertEquals("State should be ERROR after timeout", VoiceConstants.STATE_ERROR, voiceManager.getCurrentState());
        verify(callback).onRecognitionError(VoiceConstants.ERROR_TIMEOUT);
        verify(audioSessionManager).releaseAudioSession();
    }

    @Test
    public void testStartVoiceRecognition_AlreadyActive() {
        // Arrange
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);
        voiceManager.startVoiceRecognition(callback);

        // Act
        boolean result = voiceManager.startVoiceRecognition(callback);

        // Assert
        assertFalse("Should not start new recognition while active", result);
        verify(audioSessionManager, times(1)).initializeAudioSession();
    }

    @Test
    public void testStartVoiceRecognition_AfterError() {
        // Arrange
        when(permissionManager.checkMicrophonePermission()).thenReturn(false);
        voiceManager.startVoiceRecognition(callback);

        // Reset mocks and permissions
        reset(callback, audioSessionManager);
        when(permissionManager.checkMicrophonePermission()).thenReturn(true);
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);

        // Act
        boolean result = voiceManager.startVoiceRecognition(callback);

        // Assert
        assertTrue("Should start recognition after error is cleared", result);
        assertEquals("State should be LISTENING", VoiceConstants.STATE_LISTENING, voiceManager.getCurrentState());
    }

    @Test
    public void testVoiceManager_LowMemoryHandling() {
        // Arrange
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);
        voiceManager.startVoiceRecognition(callback);
        voiceManager.stopVoiceRecognition();

        // Act
        voiceManager.onLowMemory();

        // Assert
        assertEquals("State should remain IDLE", VoiceConstants.STATE_IDLE, voiceManager.getCurrentState());
        verify(audioSessionManager, times(1)).releaseAudioSession();
    }

    @Test
    public void testVoiceManager_ConfigurationChange() {
        // Arrange
        when(audioSessionManager.initializeAudioSession()).thenReturn(true);
        voiceManager.startVoiceRecognition(callback);

        // Act
        voiceManager.onConfigurationChanged();

        // Assert
        verify(audioSessionManager).releaseAudioSession();
        assertEquals("State should be IDLE after configuration change", 
            VoiceConstants.STATE_IDLE, voiceManager.getCurrentState());
    }
}