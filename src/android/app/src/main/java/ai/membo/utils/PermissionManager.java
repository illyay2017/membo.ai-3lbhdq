package ai.membo.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.util.LruCache;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Manages Android runtime permissions for the membo.ai application.
 * Handles permission checks, requests, and results with caching and analytics tracking.
 * 
 * @version 1.0
 * @since 2024-01
 */
public class PermissionManager {
    private final Context mContext;
    private final Activity mActivity;
    private final LruCache<String, Boolean> mPermissionCache;
    private final Handler mHandler;
    private PermissionCallback mCallback;

    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final long DEBOUNCE_DELAY_MS = 1000;
    private static final int CACHE_SIZE = 10;

    /**
     * Interface for handling permission request results
     */
    public interface PermissionCallback {
        /**
         * Called when a permission is granted
         * @param permission The granted permission
         */
        void onPermissionGranted(String permission);

        /**
         * Called when a permission is denied
         * @param permission The denied permission
         * @param shouldShowRationale Whether the rationale should be shown
         */
        void onPermissionDenied(String permission, boolean shouldShowRationale);
    }

    /**
     * Constructs a new PermissionManager instance
     * @param activity The activity context
     * @param callback The permission callback interface
     */
    public PermissionManager(Activity activity, PermissionCallback callback) {
        this.mActivity = activity;
        this.mContext = activity.getApplicationContext();
        this.mCallback = callback;
        this.mHandler = new Handler();
        this.mPermissionCache = new LruCache<>(CACHE_SIZE);
    }

    /**
     * Checks if microphone permission is granted
     * @return true if permission is granted, false otherwise
     */
    public boolean checkMicrophonePermission() {
        Boolean cachedResult = mPermissionCache.get(Manifest.permission.RECORD_AUDIO);
        if (cachedResult != null) {
            return cachedResult;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }

        boolean isGranted = ContextCompat.checkSelfPermission(mContext, 
            Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        mPermissionCache.put(Manifest.permission.RECORD_AUDIO, isGranted);
        return isGranted;
    }

    /**
     * Requests microphone permission with debouncing
     */
    public void requestMicrophonePermission() {
        mHandler.removeCallbacksAndMessages(null);
        mHandler.postDelayed(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                boolean shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                    mActivity, Manifest.permission.RECORD_AUDIO);
                
                if (shouldShowRationale) {
                    mCallback.onPermissionDenied(Manifest.permission.RECORD_AUDIO, true);
                } else {
                    ActivityCompat.requestPermissions(mActivity, 
                        new String[]{Manifest.permission.RECORD_AUDIO}, 
                        PERMISSION_REQUEST_CODE);
                }
            }
        }, DEBOUNCE_DELAY_MS);
    }

    /**
     * Checks if storage permissions are granted
     * @return true if permissions are granted, false otherwise
     */
    public boolean checkStoragePermission() {
        Boolean cachedResult = mPermissionCache.get(Manifest.permission.READ_EXTERNAL_STORAGE);
        if (cachedResult != null) {
            return cachedResult;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }

        boolean readGranted = ContextCompat.checkSelfPermission(mContext, 
            Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        boolean writeGranted = ContextCompat.checkSelfPermission(mContext, 
            Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;

        boolean isGranted = readGranted && writeGranted;
        mPermissionCache.put(Manifest.permission.READ_EXTERNAL_STORAGE, isGranted);
        mPermissionCache.put(Manifest.permission.WRITE_EXTERNAL_STORAGE, isGranted);
        return isGranted;
    }

    /**
     * Requests storage permissions with debouncing
     */
    public void requestStoragePermission() {
        mHandler.removeCallbacksAndMessages(null);
        mHandler.postDelayed(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                boolean shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                    mActivity, Manifest.permission.READ_EXTERNAL_STORAGE) ||
                    ActivityCompat.shouldShowRequestPermissionRationale(
                        mActivity, Manifest.permission.WRITE_EXTERNAL_STORAGE);

                if (shouldShowRationale) {
                    mCallback.onPermissionDenied(Manifest.permission.READ_EXTERNAL_STORAGE, true);
                } else {
                    ActivityCompat.requestPermissions(mActivity, 
                        new String[]{
                            Manifest.permission.READ_EXTERNAL_STORAGE,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE
                        }, 
                        PERMISSION_REQUEST_CODE);
                }
            }
        }, DEBOUNCE_DELAY_MS);
    }

    /**
     * Handles permission request results
     * @param requestCode The request code
     * @param permissions The requested permissions
     * @param grantResults The permission grant results
     */
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != PERMISSION_REQUEST_CODE) {
            return;
        }

        for (int i = 0; i < permissions.length; i++) {
            String permission = permissions[i];
            boolean isGranted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
            
            // Update cache
            mPermissionCache.put(permission, isGranted);

            // Notify callback
            if (isGranted) {
                mCallback.onPermissionGranted(permission);
            } else {
                boolean shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                    mActivity, permission);
                mCallback.onPermissionDenied(permission, shouldShowRationale);
            }
        }
    }

    /**
     * Clears the permission cache
     */
    public void clearPermissionCache() {
        mPermissionCache.evictAll();
    }
}