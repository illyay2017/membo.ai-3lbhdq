package ai.membo;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.content.Context;
import android.net.Uri;
import androidx.benchmark.junit4.BenchmarkRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import ai.membo.managers.ContentCaptureManager;
import ai.membo.utils.FileManager;

@RunWith(AndroidJUnit4.class)
public class ContentCaptureManagerTest {

    @Rule
    public BenchmarkRule benchmarkRule = new BenchmarkRule();

    private ContentCaptureManager contentCaptureManager;
    private Context context;
    
    @Mock
    private FileManager fileManager;

    private static final String TEST_WEB_CONTENT = "Test web content";
    private static final String TEST_WEB_URL = "https://example.com/article";
    private static final String TEST_PDF_CONTENT = "Test PDF content";
    private static final String TEST_PDF_PATH = "/storage/emulated/0/Download/test.pdf";
    private static final String TEST_VOICE_DATA = "Test voice content";
    private static final long MAX_RESPONSE_TIME_MS = 200; // As per SLA requirement

    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        contentCaptureManager = ContentCaptureManager.getInstance(context);
    }

    @Test
    public void testCaptureWebContent() throws Exception {
        // Prepare test data
        JSONObject metadata = new JSONObject();
        metadata.put("title", "Test Article");
        metadata.put("author", "John Doe");

        // Start performance measurement
        benchmarkRule.measureRepeated(() -> {
            try {
                long startTime = System.currentTimeMillis();

                // Capture web content
                Uri contentUri = contentCaptureManager.captureWebContent(
                    TEST_WEB_CONTENT,
                    TEST_WEB_URL,
                    metadata
                );

                // Verify response time
                long responseTime = System.currentTimeMillis() - startTime;
                assertTrue("Response time exceeds SLA", responseTime <= MAX_RESPONSE_TIME_MS);

                // Verify content was saved
                assertNotNull("Content URI should not be null", contentUri);
                
                // Verify metadata integrity
                String savedContent = fileManager.readFile(contentUri);
                assertNotNull("Saved content should not be null", savedContent);
                assertEquals("Content should match original", TEST_WEB_CONTENT, savedContent);

                // Verify secure cleanup
                assertTrue("Content should be securely deleted", 
                    fileManager.deleteFile(contentUri));

            } catch (Exception e) {
                fail("Should not throw exception: " + e.getMessage());
            }
        });
    }

    @Test
    public void testCapturePdfContent() throws Exception {
        // Prepare test data
        JSONObject metadata = new JSONObject();
        metadata.put("page", 1);
        metadata.put("total_pages", 10);

        // Start performance measurement
        benchmarkRule.measureRepeated(() -> {
            try {
                long startTime = System.currentTimeMillis();

                // Capture PDF content
                Uri contentUri = contentCaptureManager.capturePdfContent(
                    TEST_PDF_CONTENT,
                    TEST_PDF_PATH,
                    1,
                    metadata
                );

                // Verify response time
                long responseTime = System.currentTimeMillis() - startTime;
                assertTrue("Response time exceeds SLA", responseTime <= MAX_RESPONSE_TIME_MS);

                // Verify content was saved
                assertNotNull("Content URI should not be null", contentUri);

                // Test large PDF handling
                String largePdfContent = "A".repeat(1024 * 1024); // 1MB content
                Uri largeContentUri = contentCaptureManager.capturePdfContent(
                    largePdfContent,
                    TEST_PDF_PATH,
                    2,
                    metadata
                );
                assertNotNull("Large content URI should not be null", largeContentUri);

                // Cleanup
                fileManager.deleteFile(contentUri);
                fileManager.deleteFile(largeContentUri);

            } catch (Exception e) {
                fail("Should not throw exception: " + e.getMessage());
            }
        });
    }

    @Test
    public void testVoiceDataHandling() throws Exception {
        // Prepare test data
        JSONObject metadata = new JSONObject();
        metadata.put("duration_ms", 5000);
        metadata.put("language", "en-US");

        // Test voice content capture
        Uri voiceUri = contentCaptureManager.captureVoiceContent(
            TEST_VOICE_DATA.getBytes(),
            metadata
        );
        assertNotNull("Voice URI should not be null", voiceUri);

        // Verify 24-hour deletion schedule
        verify(fileManager).scheduleFileDeletion(
            any(Uri.class),
            eq(24L * 60L * 60L * 1000L)
        );

        // Verify secure cleanup
        assertTrue("Voice data should be securely deleted", 
            fileManager.deleteFile(voiceUri));

        // Test voice processing performance
        benchmarkRule.measureRepeated(() -> {
            try {
                long startTime = System.currentTimeMillis();
                contentCaptureManager.captureVoiceContent(
                    TEST_VOICE_DATA.getBytes(),
                    metadata
                );
                long responseTime = System.currentTimeMillis() - startTime;
                assertTrue("Voice processing exceeds SLA", responseTime <= MAX_RESPONSE_TIME_MS);
            } catch (Exception e) {
                fail("Should not throw exception: " + e.getMessage());
            }
        });
    }

    @Test
    public void testContentSync() throws Exception {
        // Prepare test content
        JSONObject metadata = new JSONObject();
        metadata.put("sync_test", true);

        // Test real-time sync performance
        benchmarkRule.measureRepeated(() -> {
            try {
                long startTime = System.currentTimeMillis();
                Uri contentUri = contentCaptureManager.captureWebContent(
                    TEST_WEB_CONTENT,
                    TEST_WEB_URL,
                    metadata
                );
                long syncTime = System.currentTimeMillis() - startTime;
                assertTrue("Sync time exceeds SLA", syncTime <= MAX_RESPONSE_TIME_MS);

                // Verify sync status
                String syncedContent = fileManager.readFile(contentUri);
                assertNotNull("Synced content should not be null", syncedContent);

                // Cleanup
                fileManager.deleteFile(contentUri);
            } catch (Exception e) {
                fail("Should not throw exception: " + e.getMessage());
            }
        });
    }

    @Test
    public void testErrorHandling() {
        // Test network failure
        when(fileManager.readFile(any(Uri.class)))
            .thenThrow(new RuntimeException("Network error"));

        try {
            JSONObject metadata = new JSONObject();
            Uri contentUri = contentCaptureManager.captureWebContent(
                TEST_WEB_CONTENT,
                TEST_WEB_URL,
                metadata
            );
            fail("Should throw exception on network error");
        } catch (Exception e) {
            assertTrue("Should handle network error gracefully", 
                e.getMessage().contains("Network error"));
        }

        // Test storage permission error
        when(fileManager.checkStoragePermission()).thenReturn(false);
        try {
            JSONObject metadata = new JSONObject();
            contentCaptureManager.captureWebContent(
                TEST_WEB_CONTENT,
                TEST_WEB_URL,
                metadata
            );
            fail("Should throw exception on permission error");
        } catch (SecurityException e) {
            assertTrue("Should handle permission error correctly", 
                e.getMessage().contains("permission"));
        }

        // Verify error reporting
        verify(fileManager, times(2)).checkStoragePermission();
    }
}