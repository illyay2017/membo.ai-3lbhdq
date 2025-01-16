//
// ErrorCodes.h
// membo
//
// Created by membo.ai
// Copyright © 2024 membo.ai. All rights reserved.
//

#import <Foundation/Foundation.h> // Foundation v17.0+

NS_ASSUME_NONNULL_BEGIN

#pragma mark - Error Domain

/// The domain for all membo.ai application errors
extern NSString * const MEMBO_ERROR_DOMAIN;

#pragma mark - Error Code Constants

/// Authentication error - HTTP 401
extern NSString * const MEMBO_ERROR_UNAUTHORIZED;

/// Authorization error - HTTP 403
extern NSString * const MEMBO_ERROR_FORBIDDEN;

/// Resource not found - HTTP 404
extern NSString * const MEMBO_ERROR_NOT_FOUND;

/// Invalid request parameters - HTTP 400
extern NSString * const MEMBO_ERROR_BAD_REQUEST;

/// Request validation failed - HTTP 422
extern NSString * const MEMBO_ERROR_VALIDATION;

/// Rate limit exceeded - HTTP 429
extern NSString * const MEMBO_ERROR_RATE_LIMIT;

/// Internal server error - HTTP 500
extern NSString * const MEMBO_ERROR_INTERNAL;

/// Service temporarily unavailable - HTTP 503
extern NSString * const MEMBO_ERROR_SERVICE_UNAVAILABLE;

/// Network connectivity error - No HTTP code
extern NSString * const MEMBO_ERROR_NETWORK;

/// Request timeout - HTTP 408
extern NSString * const MEMBO_ERROR_TIMEOUT;

#pragma mark - Error Utilities

/**
 Validates if a given error code is recognized by the application.
 
 @param errorCode The error code string to validate
 @return YES if the code is valid, NO otherwise
 */
BOOL isValidErrorCode(NSString *errorCode) NS_SWIFT_NAME(isValid(errorCode:));

/**
 Returns a localized error message for the given error code with optional context parameters.
 
 @param errorCode The error code to get the message for
 @param context Optional dictionary of context parameters for message substitution
 @return Localized error message string with context substitutions applied
 */
NSString * _Nullable localizedMessageForErrorCode(NSString *errorCode, NSDictionary<NSString *, id> * _Nullable context) 
    NS_SWIFT_NAME(localizedMessage(forErrorCode:context:));

/**
 Creates an NSError instance with the given error code and optional user info.
 
 @param errorCode The error code string
 @param userInfo Optional dictionary of additional error information
 @return Configured NSError instance with domain, code and localized description
 */
NSError * _Nonnull errorWithCode(NSString *errorCode, NSDictionary * _Nullable userInfo)
    NS_SWIFT_NAME(error(withCode:userInfo:));

NS_ASSUME_NONNULL_END