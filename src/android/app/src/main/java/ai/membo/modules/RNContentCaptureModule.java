package ai.membo.modules;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import android.util.Log;
import org.json.JSONObject;

import ai.membo.managers.ContentCaptureManager;

/**
 * React Native bridge module that provides native content capture functionality.
 * Enables web highlights, PDF content capture, and text selection with proper storage and synchronization.
 *
 * @version 1.0
 * @since 2024-01
 */
public class RNContentCaptureModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RNContentCapture";
    private final ReactApplicationContext mReactContext;
    private final ContentCaptureManager mContentCaptureManager;

    public RNContentCaptureModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.mReactContext = reactContext;
        this.mContentCaptureManager = ContentCaptureManager.getInstance(reactContext);
    }

    @Override
    public String getName() {
        return "RNContentCapture";
    }

    /**
     * Captures general content with metadata and performance tracking
     */
    @ReactMethod
    public void captureContent(String content, ReadableMap metadata, Promise promise) {
        if (content == null || content.trim().isEmpty()) {
            promise.reject("INVALID_CONTENT", "Content cannot be empty");
            return;
        }

        try {
            // Convert ReadableMap to JSONObject
            JSONObject metadataJson = new JSONObject();
            if (metadata != null) {
                metadataJson = new JSONObject(metadata.toHashMap());
            }

            // Add capture timestamp
            metadataJson.put("captured_at", System.currentTimeMillis());
            metadataJson.put("platform", "android");

            // Capture content through manager
            String filename = generateFilename("general", content);
            promise.resolve(mContentCaptureManager.captureWebContent(
                content,
                metadataJson.optString("source_url", ""),
                metadataJson
            ).toString());
        } catch (Exception e) {
            Log.e(TAG, "Failed to capture content", e);
            promise.reject("CAPTURE_ERROR", "Failed to capture content: " + e.getMessage());
        }
    }

    /**
     * Captures content from web sources with security measures
     */
    @ReactMethod
    public void captureWebContent(String content, String url, Promise promise) {
        if (content == null || content.trim().isEmpty()) {
            promise.reject("INVALID_CONTENT", "Content cannot be empty");
            return;
        }

        if (url == null || url.trim().isEmpty()) {
            promise.reject("INVALID_URL", "URL cannot be empty");
            return;
        }

        try {
            // Create metadata for web content
            JSONObject metadata = new JSONObject();
            metadata.put("source", "web");
            metadata.put("url", url);
            metadata.put("captured_at", System.currentTimeMillis());
            metadata.put("platform", "android");

            // Capture web content
            promise.resolve(mContentCaptureManager.captureWebContent(
                content,
                url,
                metadata
            ).toString());
        } catch (Exception e) {
            Log.e(TAG, "Failed to capture web content", e);
            promise.reject("CAPTURE_ERROR", "Failed to capture web content: " + e.getMessage());
        }
    }

    /**
     * Captures selected content from PDF documents with optimization
     */
    @ReactMethod
    public void capturePdfContent(String uri, String selectedText, ReadableMap metadata, Promise promise) {
        if (uri == null || uri.trim().isEmpty()) {
            promise.reject("INVALID_URI", "PDF URI cannot be empty");
            return;
        }

        if (selectedText == null || selectedText.trim().isEmpty()) {
            promise.reject("INVALID_SELECTION", "Selected text cannot be empty");
            return;
        }

        try {
            // Convert ReadableMap to JSONObject
            JSONObject metadataJson = new JSONObject();
            if (metadata != null) {
                metadataJson = new JSONObject(metadata.toHashMap());
            }

            // Add PDF-specific metadata
            metadataJson.put("source", "pdf");
            metadataJson.put("file_uri", uri);
            metadataJson.put("captured_at", System.currentTimeMillis());
            metadataJson.put("platform", "android");

            // Extract page number if available
            int page = metadataJson.optInt("page", 1);

            // Capture PDF content
            promise.resolve(mContentCaptureManager.capturePdfContent(
                selectedText,
                uri,
                page,
                metadataJson
            ).toString());
        } catch (Exception e) {
            Log.e(TAG, "Failed to capture PDF content", e);
            promise.reject("CAPTURE_ERROR", "Failed to capture PDF content: " + e.getMessage());
        }
    }

    /**
     * Generates a unique filename for content
     */
    private String generateFilename(String type, String content) {
        return type + "_" + System.currentTimeMillis() + "_" + 
               Math.abs(content.hashCode()) + ".txt";
    }

    /**
     * Cleanup resources when module is destroyed
     */
    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        // Cleanup will be handled by ContentCaptureManager
    }
}