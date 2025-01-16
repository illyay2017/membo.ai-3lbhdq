package ai.membo.managers;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.WorkerThread;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.Queue;

import io.github.supabase.postgrest.PostgrestClient; // version: 0.1.0
import com.amazon.kindle.api.KindleClient; // version: 1.0.0

import ai.membo.utils.FileManager;

/**
 * Core manager class responsible for handling content capture operations in the Android application.
 * Implements real-time synchronization with Supabase backend and supports multiple content sources.
 *
 * @version 1.0
 * @since 2024-01
 */
public class ContentCaptureManager {
    private static final String TAG = "ContentCaptureManager";
    private static final int SYNC_RETRY_ATTEMPTS = 3;
    private static final long SYNC_RETRY_DELAY_MS = 1000;
    private static final int SYNC_QUEUE_CAPACITY = 100;
    private static final long SYNC_TIMEOUT_MS = 200; // As per SLA requirement

    private static ContentCaptureManager instance;
    private final Context mContext;
    private final FileManager mFileManager;
    private final Executor mExecutor;
    private final PostgrestClient mSupabaseClient;
    private final KindleClient mKindleClient;
    private final Queue<Uri> mSyncQueue;

    /**
     * Private constructor for singleton pattern
     */
    private ContentCaptureManager(Context context) {
        mContext = context.getApplicationContext();
        mFileManager = FileManager.getInstance(context);
        mExecutor = Executors.newFixedThreadPool(3); // Separate threads for capture, sync, and processing
        mSupabaseClient = initializeSupabaseClient();
        mKindleClient = initializeKindleClient();
        mSyncQueue = new LinkedBlockingQueue<>(SYNC_QUEUE_CAPACITY);
    }

    /**
     * Returns singleton instance of ContentCaptureManager
     */
    @NonNull
    public static synchronized ContentCaptureManager getInstance(Context context) {
        if (instance == null) {
            instance = new ContentCaptureManager(context);
        }
        return instance;
    }

    /**
     * Captures web content with metadata
     */
    @NonNull
    public Uri captureWebContent(String content, String url, JSONObject metadata) throws IOException {
        try {
            JSONObject enrichedMetadata = new JSONObject(metadata.toString());
            enrichedMetadata.put("source", "web");
            enrichedMetadata.put("url", url);
            enrichedMetadata.put("captured_at", System.currentTimeMillis());

            String filename = generateFilename("web", url);
            Uri contentUri = mFileManager.saveCapturedContent(content, filename);
            queueForSync(contentUri, enrichedMetadata);
            return contentUri;
        } catch (JSONException e) {
            throw new IOException("Failed to process web content metadata", e);
        }
    }

    /**
     * Captures PDF content with page information
     */
    @NonNull
    public Uri capturePdfContent(String content, String pdfPath, int page, JSONObject metadata) throws IOException {
        try {
            JSONObject enrichedMetadata = new JSONObject(metadata.toString());
            enrichedMetadata.put("source", "pdf");
            enrichedMetadata.put("file_path", pdfPath);
            enrichedMetadata.put("page", page);
            enrichedMetadata.put("captured_at", System.currentTimeMillis());

            String filename = generateFilename("pdf", pdfPath + "_p" + page);
            Uri contentUri = mFileManager.saveCapturedContent(content, filename);
            queueForSync(contentUri, enrichedMetadata);
            return contentUri;
        } catch (JSONException e) {
            throw new IOException("Failed to process PDF content metadata", e);
        }
    }

    /**
     * Captures Kindle content with book metadata
     */
    @NonNull
    public Uri captureKindleContent(String bookId, String highlightText, JSONObject metadata) throws IOException {
        try {
            // Fetch book metadata from Kindle API
            JSONObject bookMetadata = mKindleClient.getBookMetadata(bookId);
            
            JSONObject enrichedMetadata = new JSONObject(metadata.toString());
            enrichedMetadata.put("source", "kindle");
            enrichedMetadata.put("book_id", bookId);
            enrichedMetadata.put("book_title", bookMetadata.optString("title"));
            enrichedMetadata.put("book_author", bookMetadata.optString("author"));
            enrichedMetadata.put("captured_at", System.currentTimeMillis());

            String filename = generateFilename("kindle", bookId);
            Uri contentUri = mFileManager.saveCapturedContent(highlightText, filename);
            queueForSync(contentUri, enrichedMetadata);
            return contentUri;
        } catch (JSONException e) {
            throw new IOException("Failed to process Kindle content metadata", e);
        }
    }

    /**
     * Synchronizes captured content with Supabase backend
     */
    @WorkerThread
    private boolean syncContent(Uri contentUri, JSONObject metadata) {
        long startTime = System.currentTimeMillis();
        int attempts = 0;

        while (attempts < SYNC_RETRY_ATTEMPTS) {
            try {
                String content = mFileManager.readFile(contentUri);
                if (content == null) {
                    Log.e(TAG, "Failed to read content file: " + contentUri);
                    return false;
                }

                // Prepare sync payload
                JSONObject payload = new JSONObject();
                payload.put("content", content);
                payload.put("metadata", metadata);
                payload.put("sync_timestamp", System.currentTimeMillis());

                // Sync with Supabase with timeout
                boolean success = mSupabaseClient.from("content")
                    .insert(payload.toString())
                    .timeout(SYNC_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                    .execute()
                    .getStatus() == 201;

                if (success) {
                    Log.d(TAG, "Content synced successfully: " + contentUri);
                    return true;
                }

                attempts++;
                if (attempts < SYNC_RETRY_ATTEMPTS) {
                    Thread.sleep(SYNC_RETRY_DELAY_MS);
                }
            } catch (Exception e) {
                Log.e(TAG, "Sync failed for content: " + contentUri, e);
                attempts++;
                if (attempts < SYNC_RETRY_ATTEMPTS) {
                    try {
                        Thread.sleep(SYNC_RETRY_DELAY_MS);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                }
            }
        }

        Log.e(TAG, "Sync failed after " + attempts + " attempts for: " + contentUri);
        return false;
    }

    /**
     * Queues content for synchronization
     */
    private void queueForSync(Uri contentUri, JSONObject metadata) {
        if (mSyncQueue.offer(contentUri)) {
            mExecutor.execute(() -> syncContent(contentUri, metadata));
        } else {
            Log.e(TAG, "Sync queue is full, dropping content: " + contentUri);
        }
    }

    /**
     * Generates unique filename for content
     */
    private String generateFilename(String source, String identifier) {
        return source + "_" + System.currentTimeMillis() + "_" + 
               Math.abs(identifier.hashCode()) + ".enc";
    }

    /**
     * Initializes Supabase client with configuration
     */
    private PostgrestClient initializeSupabaseClient() {
        // Initialize with project configuration
        return new PostgrestClient(
            BuildConfig.SUPABASE_URL,
            BuildConfig.SUPABASE_ANON_KEY
        );
    }

    /**
     * Initializes Kindle client with configuration
     */
    private KindleClient initializeKindleClient() {
        return new KindleClient.Builder()
            .setContext(mContext)
            .setApiKey(BuildConfig.KINDLE_API_KEY)
            .build();
    }
}