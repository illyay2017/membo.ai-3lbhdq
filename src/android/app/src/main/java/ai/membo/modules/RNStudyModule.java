package ai.membo.modules;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import ai.membo.managers.StudyManager;
import ai.membo.constants.StudyModes;
import ai.membo.models.Card;
import ai.membo.models.StudyAnalytics;

/**
 * React Native module that provides access to native study functionality with enhanced error handling,
 * resource management, and performance optimizations.
 *
 * @version 1.0
 * @since 2024-01
 */
public class RNStudyModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNStudyModule";
    private static final String MODULE_NAME = "RNStudyModule";

    private final StudyManager mStudyManager;
    private final ReactApplicationContext mReactContext;
    private final Handler mHandler;
    private final Map<String, Object> mResultCache;
    private boolean mIsSessionActive;

    public RNStudyModule(ReactApplicationContext reactContext) {
        super(reactContext);
        mReactContext = reactContext;
        mStudyManager = new StudyManager(
            reactContext.getApplicationContext(),
            new VoiceManager(reactContext),
            new FSRSParameters()
        );
        mHandler = new Handler(Looper.getMainLooper());
        mResultCache = new ConcurrentHashMap<>();
        mIsSessionActive = false;

        setupStudyManagerCallback();
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Starts a new study session with specified mode and cards
     */
    @ReactMethod
    public void startStudySession(String studyMode, ReadableArray cardIds, final Promise promise) {
        if (mIsSessionActive) {
            promise.reject("SESSION_ACTIVE", "A study session is already in progress");
            return;
        }

        if (!validateStudyMode(studyMode)) {
            promise.reject("INVALID_MODE", "Invalid study mode: " + studyMode);
            return;
        }

        try {
            List<Card> cards = convertToCardList(cardIds);
            if (cards.isEmpty()) {
                promise.reject("NO_CARDS", "No valid cards provided");
                return;
            }

            mHandler.post(() -> {
                StudyManager.StudySessionCallback callback = new StudyManager.StudySessionCallback() {
                    @Override
                    public void onSessionStarted(String mode, int cardCount) {
                        WritableMap params = Arguments.createMap();
                        params.putString("mode", mode);
                        params.putInt("cardCount", cardCount);
                        sendEvent("onStudySessionStarted", params);
                    }

                    @Override
                    public void onCardPresented(Card card) {
                        WritableMap cardData = Arguments.createMap();
                        cardData.putString("id", card.getId());
                        cardData.putMap("frontContent", Arguments.makeNativeMap(card.getFrontContent()));
                        cardData.putMap("backContent", Arguments.makeNativeMap(card.getBackContent()));
                        sendEvent("onCardPresented", cardData);
                    }

                    @Override
                    public void onAnswerProcessed(Card card, double retention) {
                        WritableMap result = Arguments.createMap();
                        result.putString("cardId", card.getId());
                        result.putDouble("retention", retention);
                        result.putDouble("nextReview", card.getNextReview().getTime());
                        sendEvent("onAnswerProcessed", result);
                    }

                    @Override
                    public void onSessionCompleted(StudyAnalytics analytics) {
                        WritableMap stats = Arguments.createMap();
                        stats.putInt("cardsStudied", analytics.getCardsStudied());
                        stats.putDouble("averageRetention", analytics.getRetentionRate());
                        stats.putInt("streak", analytics.getCurrentStreak());
                        sendEvent("onStudySessionCompleted", stats);
                    }

                    @Override
                    public void onError(String error) {
                        sendEvent("onStudyError", Arguments.createMap().putString("error", error));
                    }
                };

                boolean started = mStudyManager.startStudySession(studyMode, cards, callback);
                if (started) {
                    mIsSessionActive = true;
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("success", true);
                    result.putInt("cardCount", cards.size());
                    promise.resolve(result);
                } else {
                    promise.reject("START_FAILED", "Failed to start study session");
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error starting study session", e);
            promise.reject("EXCEPTION", e.getMessage());
        }
    }

    /**
     * Submits a response for the current card
     */
    @ReactMethod
    public void submitCardResponse(int rating, final Promise promise) {
        if (!mIsSessionActive) {
            promise.reject("NO_SESSION", "No active study session");
            return;
        }

        if (rating < 1 || rating > 5) {
            promise.reject("INVALID_RATING", "Rating must be between 1 and 5");
            return;
        }

        String cacheKey = "response_" + rating;
        if (mResultCache.containsKey(cacheKey)) {
            promise.resolve(mResultCache.get(cacheKey));
            return;
        }

        mHandler.post(() -> {
            try {
                mStudyManager.submitCardResponse(rating);
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putInt("rating", rating);
                
                mResultCache.put(cacheKey, result);
                promise.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Error submitting card response", e);
                promise.reject("EXCEPTION", e.getMessage());
            }
        });
    }

    /**
     * Ends the current study session
     */
    @ReactMethod
    public void endStudySession(final Promise promise) {
        if (!mIsSessionActive) {
            promise.reject("NO_SESSION", "No active study session");
            return;
        }

        mHandler.post(() -> {
            try {
                mStudyManager.endStudySession();
                mIsSessionActive = false;
                mResultCache.clear();
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                promise.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Error ending study session", e);
                promise.reject("EXCEPTION", e.getMessage());
            }
        });
    }

    @Override
    public void onCatalystInstanceDestroy() {
        if (mIsSessionActive) {
            mStudyManager.endStudySession();
        }
        mResultCache.clear();
        mHandler.removeCallbacksAndMessages(null);
        super.onCatalystInstanceDestroy();
    }

    // Private helper methods

    private boolean validateStudyMode(String mode) {
        return StudyModes.STANDARD.equals(mode) ||
               StudyModes.VOICE.equals(mode) ||
               StudyModes.QUIZ.equals(mode);
    }

    private List<Card> convertToCardList(ReadableArray cardIds) {
        List<Card> cards = new ArrayList<>();
        for (int i = 0; i < cardIds.size(); i++) {
            String cardId = cardIds.getString(i);
            if (cardId != null && !cardId.isEmpty()) {
                Card card = new Card(cardId);
                cards.add(card);
            }
        }
        return cards;
    }

    private void sendEvent(String eventName, WritableMap params) {
        mReactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("STUDY_MODE_STANDARD", StudyModes.STANDARD);
        constants.put("STUDY_MODE_VOICE", StudyModes.VOICE);
        constants.put("STUDY_MODE_QUIZ", StudyModes.QUIZ);
        return constants;
    }
}