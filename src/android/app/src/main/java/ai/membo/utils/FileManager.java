package ai.membo.utils;

import android.content.Context;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Manages secure file operations for the membo.ai Android application.
 * Implements encryption, ephemeral storage, and automatic cleanup for sensitive data.
 *
 * @version 1.0
 * @since 2024-01
 */
public class FileManager {
    private static final String TAG = "FileManager";
    private static FileManager instance;
    private final Context mContext;
    private final PermissionManager mPermissionManager;
    private final Cipher encryptionCipher;
    private final Cipher decryptionCipher;
    private final ScheduledExecutorService cleanupExecutor;

    private static final String CONTENT_DIR = "content";
    private static final String VOICE_DIR = "voice";
    private static final String TEMP_DIR = "temp";
    private static final int ENCRYPTION_BLOCK_SIZE = 256;
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final long VOICE_FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    private static final String KEYSTORE_ALIAS = "membo_file_encryption_key";

    /**
     * Private constructor initializing encryption and directory structure
     */
    private FileManager(Context context) {
        this.mContext = context.getApplicationContext();
        this.mPermissionManager = new PermissionManager(null, null);
        this.cleanupExecutor = Executors.newSingleThreadScheduledExecutor();

        try {
            // Initialize encryption
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
            );
            KeyGenParameterSpec keySpec = new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build();

            keyGenerator.init(keySpec);
            SecretKey key = keyGenerator.generateKey();

            encryptionCipher = Cipher.getInstance("AES/GCM/NoPadding");
            decryptionCipher = Cipher.getInstance("AES/GCM/NoPadding");

            // Create required directories
            createSecureDirectory(CONTENT_DIR);
            createSecureDirectory(VOICE_DIR);
            createSecureDirectory(TEMP_DIR);

            // Schedule cleanup task
            scheduleCleanupTask();
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize FileManager", e);
        }
    }

    /**
     * Returns singleton instance with double-checked locking
     */
    @NonNull
    public static FileManager getInstance(Context context) {
        if (instance == null) {
            synchronized (FileManager.class) {
                if (instance == null) {
                    instance = new FileManager(context);
                }
            }
        }
        return instance;
    }

    /**
     * Encrypts and saves captured content with integrity checks
     */
    @NonNull
    @WorkerThread
    public Uri saveCapturedContent(String content, String filename) throws IOException {
        if (!mPermissionManager.checkStoragePermission()) {
            throw new SecurityException("Storage permission not granted");
        }

        File contentFile = new File(mContext.getDir(CONTENT_DIR, Context.MODE_PRIVATE), filename);
        try {
            // Generate random IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            // Initialize encryption cipher
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            encryptionCipher.init(Cipher.ENCRYPT_MODE, getEncryptionKey(), parameterSpec);

            // Encrypt content
            byte[] contentBytes = content.getBytes("UTF-8");
            byte[] encryptedContent = encryptionCipher.doFinal(contentBytes);

            // Write to file atomically
            File tempFile = new File(contentFile.getPath() + ".tmp");
            try (FileOutputStream fos = new FileOutputStream(tempFile);
                 FileChannel channel = fos.getChannel()) {
                
                ByteBuffer buffer = ByteBuffer.allocate(iv.length + encryptedContent.length);
                buffer.put(iv);
                buffer.put(encryptedContent);
                buffer.flip();
                
                channel.write(buffer);
                channel.force(true);
            }

            if (!tempFile.renameTo(contentFile)) {
                throw new IOException("Failed to save content file");
            }

            return Uri.fromFile(contentFile);
        } catch (Exception e) {
            throw new IOException("Failed to save content", e);
        }
    }

    /**
     * Saves voice recording with 24-hour expiry
     */
    @NonNull
    @WorkerThread
    public Uri saveVoiceRecording(byte[] audioData, String filename) throws IOException {
        if (!mPermissionManager.checkStoragePermission()) {
            throw new SecurityException("Storage permission not granted");
        }

        File voiceFile = new File(mContext.getDir(VOICE_DIR, Context.MODE_PRIVATE), filename);
        try {
            // Generate random IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            // Initialize encryption cipher
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            encryptionCipher.init(Cipher.ENCRYPT_MODE, getEncryptionKey(), parameterSpec);

            // Encrypt audio data
            byte[] encryptedAudio = encryptionCipher.doFinal(audioData);

            // Write to file atomically
            File tempFile = new File(voiceFile.getPath() + ".tmp");
            try (FileOutputStream fos = new FileOutputStream(tempFile);
                 FileChannel channel = fos.getChannel()) {
                
                ByteBuffer buffer = ByteBuffer.allocate(iv.length + encryptedAudio.length);
                buffer.put(iv);
                buffer.put(encryptedAudio);
                buffer.flip();
                
                channel.write(buffer);
                channel.force(true);
            }

            if (!tempFile.renameTo(voiceFile)) {
                throw new IOException("Failed to save voice file");
            }

            // Schedule deletion
            scheduleFileDeletion(voiceFile, VOICE_FILE_TTL_MS);

            return Uri.fromFile(voiceFile);
        } catch (Exception e) {
            throw new IOException("Failed to save voice recording", e);
        }
    }

    /**
     * Reads and decrypts file with integrity verification
     */
    @Nullable
    @WorkerThread
    public String readFile(Uri fileUri) throws IOException {
        File file = new File(fileUri.getPath());
        if (!file.exists() || !file.canRead()) {
            return null;
        }

        try (FileInputStream fis = new FileInputStream(file)) {
            // Read IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            if (fis.read(iv) != GCM_IV_LENGTH) {
                throw new IOException("Invalid file format");
            }

            // Read encrypted content
            byte[] encryptedContent = new byte[(int) file.length() - GCM_IV_LENGTH];
            if (fis.read(encryptedContent) != encryptedContent.length) {
                throw new IOException("Failed to read encrypted content");
            }

            // Initialize decryption cipher
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            decryptionCipher.init(Cipher.DECRYPT_MODE, getEncryptionKey(), parameterSpec);

            // Decrypt content
            byte[] decryptedContent = decryptionCipher.doFinal(encryptedContent);
            return new String(decryptedContent, "UTF-8");
        } catch (Exception e) {
            throw new IOException("Failed to read file", e);
        }
    }

    /**
     * Securely deletes file with overwriting
     */
    @WorkerThread
    public boolean deleteFile(Uri fileUri) {
        File file = new File(fileUri.getPath());
        if (!file.exists()) {
            return false;
        }

        try {
            // Overwrite file content
            try (FileOutputStream fos = new FileOutputStream(file)) {
                byte[] zeros = new byte[ENCRYPTION_BLOCK_SIZE];
                Arrays.fill(zeros, (byte) 0);
                
                long length = file.length();
                while (length > 0) {
                    int writeSize = (int) Math.min(zeros.length, length);
                    fos.write(zeros, 0, writeSize);
                    length -= writeSize;
                }
                fos.getFD().sync();
            }

            // Delete file
            return file.delete();
        } catch (IOException e) {
            Log.e(TAG, "Failed to securely delete file", e);
            return false;
        }
    }

    /**
     * Background task removing expired files
     */
    @WorkerThread
    private void cleanupExpiredFiles() {
        File voiceDir = mContext.getDir(VOICE_DIR, Context.MODE_PRIVATE);
        File[] files = voiceDir.listFiles();
        if (files == null) return;

        long now = System.currentTimeMillis();
        for (File file : files) {
            if (now - file.lastModified() > VOICE_FILE_TTL_MS) {
                deleteFile(Uri.fromFile(file));
            }
        }

        // Cleanup temp directory
        File tempDir = mContext.getDir(TEMP_DIR, Context.MODE_PRIVATE);
        File[] tempFiles = tempDir.listFiles();
        if (tempFiles != null) {
            for (File file : tempFiles) {
                deleteFile(Uri.fromFile(file));
            }
        }
    }

    private void createSecureDirectory(String dirName) {
        File dir = mContext.getDir(dirName, Context.MODE_PRIVATE);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new RuntimeException("Failed to create directory: " + dirName);
        }
    }

    private void scheduleCleanupTask() {
        cleanupExecutor.scheduleAtFixedRate(
            this::cleanupExpiredFiles,
            1, 1, TimeUnit.HOURS
        );
    }

    private void scheduleFileDeletion(File file, long delayMs) {
        cleanupExecutor.schedule(
            () -> deleteFile(Uri.fromFile(file)),
            delayMs,
            TimeUnit.MILLISECONDS
        );
    }

    private SecretKey getEncryptionKey() throws Exception {
        return android.security.keystore.KeyStore.getInstance("AndroidKeyStore")
            .getKey(KEYSTORE_ALIAS, null);
    }
}