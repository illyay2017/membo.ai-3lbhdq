package ai.membo.managers;

import android.content.Context;
import androidx.annotation.NonNull; // Version: 1.6.0
import java.util.List;
import java.util.Date;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;
import android.util.Log;

import ai.membo.constants.StudyModes;
import ai.membo.constants.StudyModeConfig;
import ai.membo.managers.VoiceManager;
import ai.membo.models.Card;
import ai.membo.models.FSRSParameters;
import ai.membo.models.StudyAnalytics;
import ai.membo.models.SessionState;

/**
 * Core manager class responsible for implementing the FSRS algorithm, managing study sessions,
 * and coordinating different study modes in the Android application.
 *
 * @version 1.0
 * @since 2024-01
 */
public class StudyManager {
    private static final String TAG = "StudyManager";
    private static final double RETENTION_THRESHOLD = 0.85; // 85% retention target
    private static final int STREAK_TARGET = 14; // 14-day streak target

    private final Context mContext;
    private final VoiceManager mVoiceManager;
    private String mCurrentStudyMode;
    private List<Card> mCurrentCards;
    private int mCurrentCardIndex;
    private boolean mIsSessionActive;
    private StudySessionCallback mCallback;
    private FSRSParameters mFsrsParams;
    private StudyAnalytics mAnalytics;
    private SessionState mSessionState;

    /**
     * Callback interface for study session events
     */
    public interface StudySessionCallback {
        void onSessionStarted(String mode, int cardCount);
        void onCardPresented(Card card);
        void onAnswerProcessed(Card card, double retention);
        void onSessionCompleted(StudyAnalytics analytics);
        void onError(String error);
    }

    /**
     * Constructs a new StudyManager instance
     */
    public StudyManager(@NonNull Context context, @NonNull VoiceManager voiceManager,
                       @NonNull FSRSParameters fsrsParams, @NonNull StudyAnalytics analytics) {
        mContext = context.getApplicationContext();
        mVoiceManager = voiceManager;
        mFsrsParams = fsrsParams;
        mAnalytics = analytics;
        mCurrentStudyMode = StudyModes.STANDARD;
        mIsSessionActive = false;
        mCurrentCards = new ArrayList<>();
        mSessionState = new SessionState();
    }

    /**
     * Starts a new study session with specified mode and cards
     */
    public synchronized boolean startStudySession(@NonNull String studyMode,
                                                @NonNull List<Card> cards,
                                                @NonNull StudySessionCallback callback) {
        if (mIsSessionActive) {
            Log.w(TAG, "Session already active");
            return false;
        }

        // Validate study mode and cards
        if (!validateStudyMode(studyMode, cards)) {
            callback.onError("Invalid study mode or card count");
            return false;
        }

        mCallback = callback;
        mCurrentStudyMode = studyMode;
        mCurrentCards = new ArrayList<>(cards);
        mCurrentCardIndex = 0;
        mIsSessionActive = true;
        mSessionState = new SessionState();

        // Initialize analytics
        mAnalytics.startSession(studyMode, cards.size());

        // Initialize voice mode if needed
        if (StudyModes.VOICE.equals(studyMode)) {
            initializeVoiceMode();
        }

        // Apply FSRS scheduling
        scheduleCards();

        mCallback.onSessionStarted(studyMode, cards.size());
        presentNextCard();

        return true;
    }

    /**
     * Processes a response for the current card using the FSRS algorithm
     */
    public synchronized void submitCardResponse(int rating) {
        if (!mIsSessionActive || mCurrentCardIndex >= mCurrentCards.size()) {
            return;
        }

        Card currentCard = mCurrentCards.get(mCurrentCardIndex);
        Date nextReview = calculateNextReview(currentCard, rating, mFsrsParams);
        currentCard.setNextReview(nextReview);

        // Update analytics
        double retention = calculateRetention(currentCard, rating);
        mAnalytics.recordResponse(currentCard, rating, retention);
        mCallback.onAnswerProcessed(currentCard, retention);

        // Move to next card or end session
        mCurrentCardIndex++;
        if (mCurrentCardIndex < mCurrentCards.size()) {
            presentNextCard();
        } else {
            endStudySession();
        }
    }

    /**
     * Calculates the next review date using the FSRS algorithm
     */
    private Date calculateNextReview(@NonNull Card card, int rating, @NonNull FSRSParameters params) {
        double stability = card.getStability();
        double difficulty = card.getDifficulty();

        // Apply FSRS formula with optimizations
        double newStability = stability * (1 + Math.exp(params.getStabilityDecay()) *
                (rating - 3) * Math.pow(difficulty, -0.5));
        
        // Adjust difficulty based on performance
        double newDifficulty = difficulty + params.getDifficultyWeight() *
                (rating - 3) * (1 - Math.exp(-stability));

        // Bound parameters
        newStability = Math.max(params.getMinStability(),
                Math.min(params.getMaxStability(), newStability));
        newDifficulty = Math.max(params.getMinDifficulty(),
                Math.min(params.getMaxDifficulty(), newDifficulty));

        // Calculate interval
        long intervalDays = Math.round(newStability * Math.log(RETENTION_THRESHOLD) /
                Math.log(0.9));
        
        // Update card parameters
        card.setStability(newStability);
        card.setDifficulty(newDifficulty);

        // Calculate next review date
        Date now = new Date();
        return new Date(now.getTime() + TimeUnit.DAYS.toMillis(intervalDays));
    }

    /**
     * Handles voice recognition results in voice study mode
     */
    private final VoiceManager.VoiceRecognitionCallback mVoiceCallback =
            new VoiceManager.VoiceRecognitionCallback() {
        @Override
        public void onRecognitionStarted() {
            mSessionState.setVoiceListening(true);
        }

        @Override
        public void onRecognitionResult(String result, float confidence) {
            if (confidence >= StudyModeConfig.VOICE_CONFIDENCE_THRESHOLD) {
                processVoiceResponse(result);
            } else {
                mCallback.onError("Low confidence voice recognition");
                restartVoiceRecognition();
            }
        }

        @Override
        public void onRecognitionError(int errorCode) {
            mCallback.onError("Voice recognition error: " + errorCode);
            restartVoiceRecognition();
        }

        @Override
        public void onRecognitionEnded() {
            mSessionState.setVoiceListening(false);
        }
    };

    /**
     * Ends the current study session and reports analytics
     */
    public synchronized void endStudySession() {
        if (!mIsSessionActive) {
            return;
        }

        if (StudyModes.VOICE.equals(mCurrentStudyMode)) {
            mVoiceManager.stopVoiceRecognition();
        }

        mAnalytics.endSession();
        mCallback.onSessionCompleted(mAnalytics);
        
        mIsSessionActive = false;
        mCurrentCards.clear();
        mCurrentCardIndex = 0;
        mSessionState = new SessionState();
    }

    /**
     * Retrieves current session analytics
     */
    public StudyAnalytics getSessionAnalytics() {
        return mAnalytics;
    }

    /**
     * Calculates current retention rate
     */
    public double getRetentionRate() {
        return mAnalytics.getRetentionRate();
    }

    // Private helper methods

    private boolean validateStudyMode(String mode, List<Card> cards) {
        int cardCount = cards.size();
        switch (mode) {
            case StudyModes.STANDARD:
                return cardCount >= StudyModeConfig.STANDARD_MIN_CARDS &&
                       cardCount <= StudyModeConfig.STANDARD_MAX_CARDS;
            case StudyModes.VOICE:
                return cardCount >= StudyModeConfig.VOICE_MIN_CARDS &&
                       cardCount <= StudyModeConfig.VOICE_MAX_CARDS;
            case StudyModes.QUIZ:
                return cardCount >= StudyModeConfig.QUIZ_MIN_CARDS &&
                       cardCount <= StudyModeConfig.QUIZ_MAX_CARDS;
            default:
                return false;
        }
    }

    private void initializeVoiceMode() {
        mVoiceManager.startVoiceRecognition(mVoiceCallback);
    }

    private void restartVoiceRecognition() {
        if (StudyModes.VOICE.equals(mCurrentStudyMode)) {
            mVoiceManager.stopVoiceRecognition();
            mVoiceManager.startVoiceRecognition(mVoiceCallback);
        }
    }

    private void presentNextCard() {
        if (mCurrentCardIndex < mCurrentCards.size()) {
            Card card = mCurrentCards.get(mCurrentCardIndex);
            mCallback.onCardPresented(card);
            
            if (StudyModes.VOICE.equals(mCurrentStudyMode)) {
                restartVoiceRecognition();
            }
        }
    }

    private void scheduleCards() {
        for (Card card : mCurrentCards) {
            if (card.getNextReview() == null) {
                card.setStability(mFsrsParams.getInitialStability());
                card.setDifficulty(mFsrsParams.getInitialDifficulty());
                card.setNextReview(new Date());
            }
        }
    }

    private double calculateRetention(Card card, int rating) {
        return Math.exp(Math.log(0.9) * Math.exp(-card.getStability() *
                (rating - 3) / mFsrsParams.getRetentionWeight()));
    }

    private void processVoiceResponse(String response) {
        Card currentCard = mCurrentCards.get(mCurrentCardIndex);
        int rating = evaluateVoiceResponse(response, currentCard);
        submitCardResponse(rating);
    }

    private int evaluateVoiceResponse(String response, Card card) {
        // Implement voice response evaluation logic
        // Return rating between 1-5 based on response accuracy
        return 3; // Default implementation
    }
}