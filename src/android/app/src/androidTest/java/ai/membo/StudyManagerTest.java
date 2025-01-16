package ai.membo;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import ai.membo.constants.StudyModes;
import ai.membo.constants.VoiceConstants;
import ai.membo.managers.StudyManager;
import ai.membo.managers.VoiceManager;
import ai.membo.models.Card;
import ai.membo.models.FSRSParameters;
import ai.membo.models.StudyAnalytics;
import ai.membo.utils.MemoryWatcher;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class StudyManagerTest {

    @Rule
    public ActivityTestRule<MainActivity> activityRule = new ActivityTestRule<>(MainActivity.class);

    @Rule
    public MemoryWatcher memoryWatcher = new MemoryWatcher();

    private Context context;
    private StudyManager studyManager;
    @Mock private VoiceManager mockVoiceManager;
    @Mock private StudyManager.StudySessionCallback mockCallback;
    private FSRSParameters fsrsParams;
    private StudyAnalytics analytics;
    private List<Card> testCards;
    private Handler mainHandler;
    private CountDownLatch latch;

    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        context = ApplicationProvider.getApplicationContext();
        mainHandler = new Handler(Looper.getMainLooper());
        latch = new CountDownLatch(1);

        // Initialize FSRS parameters
        fsrsParams = new FSRSParameters.Builder()
            .setInitialStability(2.0)
            .setInitialDifficulty(5.0)
            .setStabilityDecay(0.2)
            .setDifficultyWeight(1.0)
            .setRetentionWeight(1.0)
            .setMinStability(1.0)
            .setMaxStability(100.0)
            .setMinDifficulty(1.0)
            .setMaxDifficulty(10.0)
            .build();

        // Initialize analytics
        analytics = new StudyAnalytics();

        // Create test cards with diverse content
        testCards = createTestCards();

        // Initialize StudyManager with mocked dependencies
        studyManager = new StudyManager(context, mockVoiceManager, fsrsParams, analytics);
        studyManager.setCallback(mockCallback);
    }

    @After
    public void tearDown() {
        studyManager.endStudySession();
    }

    @Test
    public void testFSRSAlgorithmCalculations() throws Exception {
        // Start standard study session
        studyManager.startStudySession(StudyModes.STANDARD, testCards, mockCallback);

        // Verify initial scheduling
        verify(mockCallback).onSessionStarted(eq(StudyModes.STANDARD), eq(testCards.size()));

        // Test multiple response scenarios
        for (int i = 0; i < testCards.size(); i++) {
            Card card = testCards.get(i);
            Date originalReview = card.getNextReview();

            // Submit varying difficulty responses
            int rating = (i % 5) + 1; // Ratings 1-5
            studyManager.submitCardResponse(rating);

            // Verify FSRS calculations
            assertThat(card.getNextReview(), is(greaterThan(originalReview)));
            assertThat(card.getStability(), is(both(greaterThan(0.0)).and(lessThan(100.0))));
            assertThat(card.getDifficulty(), is(both(greaterThan(1.0)).and(lessThan(10.0))));
        }

        // Verify retention rate meets target
        double retentionRate = studyManager.getRetentionRate();
        assertThat(retentionRate, is(greaterThanOrEqualTo(0.85))); // 85% target
    }

    @Test
    public void testVoiceModeIntegration() throws Exception {
        // Configure voice manager mock
        doNothing().when(mockVoiceManager).startVoiceRecognition(any());
        when(mockVoiceManager.getCurrentState()).thenReturn(VoiceConstants.STATE_LISTENING);

        // Start voice study session
        studyManager.startStudySession(StudyModes.VOICE, testCards.subList(0, 5), mockCallback);
        verify(mockVoiceManager).startVoiceRecognition(any());

        // Simulate voice responses
        simulateVoiceResponse("correct answer", 0.9f);
        verify(mockCallback).onAnswerProcessed(any(Card.class), anyDouble());

        // Test error handling
        simulateVoiceError(VoiceConstants.ERROR_NETWORK);
        verify(mockVoiceManager).stopVoiceRecognition();
        verify(mockVoiceManager).startVoiceRecognition(any()); // Verify retry

        // Test audio focus changes
        simulateAudioFocusChange(AudioManager.AUDIOFOCUS_LOSS);
        verify(mockVoiceManager).stopVoiceRecognition();
    }

    @Test
    public void testDeviceStateHandling() throws Exception {
        // Start session
        studyManager.startStudySession(StudyModes.STANDARD, testCards, mockCallback);

        // Test configuration changes
        Bundle savedState = new Bundle();
        studyManager.onSaveInstanceState(savedState);
        studyManager.onConfigurationChanged();
        studyManager.onRestoreInstanceState(savedState);

        // Verify session state maintained
        assertThat(studyManager.isSessionActive(), is(true));
        verify(mockCallback, never()).onError(any());

        // Test low memory condition
        memoryWatcher.simulateLowMemory();
        studyManager.onLowMemory();

        // Verify graceful degradation
        assertThat(studyManager.isSessionActive(), is(true));
        verify(mockCallback, never()).onError(any());
    }

    private List<Card> createTestCards() {
        List<Card> cards = new ArrayList<>();
        
        // Add diverse card types
        cards.add(createCard("What is FSRS?", "Free Spaced Repetition Scheduler", "algorithm"));
        cards.add(createCard("Bonjour means?", "Hello", "french"));
        cards.add(createCard("2+2=?", "4", "math"));
        cards.add(createCard("Capital of France?", "Paris", "geography"));
        cards.add(createCard("HTTP stands for?", "HyperText Transfer Protocol", "tech"));
        
        return cards;
    }

    private Card createCard(String front, String back, String tag) {
        Card card = new Card();
        card.setFrontContent(front);
        card.setBackContent(back);
        card.addTag(tag);
        card.setStability(fsrsParams.getInitialStability());
        card.setDifficulty(fsrsParams.getInitialDifficulty());
        return card;
    }

    private void simulateVoiceResponse(String text, float confidence) {
        mainHandler.post(() -> {
            VoiceManager.VoiceRecognitionCallback callback = captureVoiceCallback();
            callback.onRecognitionResult(text, confidence);
            latch.countDown();
        });
        await();
    }

    private void simulateVoiceError(int errorCode) {
        mainHandler.post(() -> {
            VoiceManager.VoiceRecognitionCallback callback = captureVoiceCallback();
            callback.onRecognitionError(errorCode);
            latch.countDown();
        });
        await();
    }

    private void simulateAudioFocusChange(int focusChange) {
        mainHandler.post(() -> {
            VoiceManager.VoiceRecognitionCallback callback = captureVoiceCallback();
            callback.onRecognitionEnded();
            latch.countDown();
        });
        await();
    }

    private VoiceManager.VoiceRecognitionCallback captureVoiceCallback() {
        ArgumentCaptor<VoiceManager.VoiceRecognitionCallback> captor = 
            ArgumentCaptor.forClass(VoiceManager.VoiceRecognitionCallback.class);
        verify(mockVoiceManager).startVoiceRecognition(captor.capture());
        return captor.getValue();
    }

    private void await() {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}