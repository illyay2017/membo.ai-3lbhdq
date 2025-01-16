package ai.membo.constants;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.StringDef;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

/**
 * Utility class containing standardized error codes and messages for consistent error handling
 * across the Android application. Implements RFC 7807 Problem Details standard with type-safe
 * validation and localized message support.
 */
public final class ErrorCodes {
    private static final String TAG = "ErrorCodes";

    // Prevent instantiation
    private ErrorCodes() {}

    /**
     * Type-safe string definition for error codes
     */
    @Retention(RetentionPolicy.SOURCE)
    @StringDef({
        ERROR_BAD_REQUEST,
        ERROR_UNAUTHORIZED,
        ERROR_FORBIDDEN,
        ERROR_NOT_FOUND,
        ERROR_VALIDATION,
        ERROR_RATE_LIMIT,
        ERROR_INTERNAL,
        ERROR_SERVICE_UNAVAILABLE
    })
    public @interface ErrorCode {}

    // Standard error code constants matching RFC 7807 Problem Details
    public static final String ERROR_BAD_REQUEST = "BAD_REQUEST";
    public static final String ERROR_UNAUTHORIZED = "UNAUTHORIZED";
    public static final String ERROR_FORBIDDEN = "FORBIDDEN";
    public static final String ERROR_NOT_FOUND = "NOT_FOUND";
    public static final String ERROR_VALIDATION = "VALIDATION_ERROR";
    public static final String ERROR_RATE_LIMIT = "RATE_LIMIT_EXCEEDED";
    public static final String ERROR_INTERNAL = "INTERNAL_SERVER_ERROR";
    public static final String ERROR_SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE";

    /**
     * Validates if a given error code string is a recognized error code.
     * Provides null safety and logs warnings for invalid codes.
     *
     * @param errorCode The error code string to validate
     * @return true if the code is valid, false otherwise
     */
    public static boolean isValidErrorCode(@Nullable String errorCode) {
        if (errorCode == null) {
            return false;
        }

        switch (errorCode) {
            case ERROR_BAD_REQUEST:
            case ERROR_UNAUTHORIZED:
            case ERROR_FORBIDDEN:
            case ERROR_NOT_FOUND:
            case ERROR_VALIDATION:
            case ERROR_RATE_LIMIT:
            case ERROR_INTERNAL:
            case ERROR_SERVICE_UNAVAILABLE:
                return true;
            default:
                Log.w(TAG, "Invalid error code encountered: " + errorCode);
                return false;
        }
    }

    /**
     * Returns a localized error message for the given error code.
     * Supports message formatting with optional arguments.
     *
     * @param context The Android context for resource access
     * @param errorCode The error code to get the message for
     * @param formatArgs Optional format arguments for the message
     * @return Localized error message string
     * @throws IllegalArgumentException if context is null or error code is invalid
     */
    public static String getLocalizedMessage(
            @NonNull Context context,
            @ErrorCode String errorCode,
            @Nullable Object... formatArgs) {
        
        if (context == null) {
            throw new IllegalArgumentException("Context cannot be null");
        }

        if (!isValidErrorCode(errorCode)) {
            throw new IllegalArgumentException("Invalid error code: " + errorCode);
        }

        int messageResId;
        switch (errorCode) {
            case ERROR_BAD_REQUEST:
                messageResId = R.string.error_bad_request;
                break;
            case ERROR_UNAUTHORIZED:
                messageResId = R.string.error_unauthorized;
                break;
            case ERROR_FORBIDDEN:
                messageResId = R.string.error_forbidden;
                break;
            case ERROR_NOT_FOUND:
                messageResId = R.string.error_not_found;
                break;
            case ERROR_VALIDATION:
                messageResId = R.string.error_validation;
                break;
            case ERROR_RATE_LIMIT:
                messageResId = R.string.error_rate_limit;
                break;
            case ERROR_INTERNAL:
                messageResId = R.string.error_internal;
                break;
            case ERROR_SERVICE_UNAVAILABLE:
                messageResId = R.string.error_service_unavailable;
                break;
            default:
                messageResId = R.string.error_unknown;
        }

        try {
            return formatArgs != null && formatArgs.length > 0
                    ? context.getString(messageResId, formatArgs)
                    : context.getString(messageResId);
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving localized message", e);
            return context.getString(R.string.error_unknown);
        }
    }
}