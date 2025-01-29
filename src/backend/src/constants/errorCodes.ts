/**
 * Error codes and messages implementing RFC 7807 Problem Details standard
 * for consistent error handling across the application.
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */

/**
 * Enum of error codes for type-safe error handling
 */
export enum ErrorCodes {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY'
}

/**
 * User-friendly error messages that avoid exposing sensitive information
 * Follows security best practices for error handling
 */
export const ErrorMessages = {
  [ErrorCodes.BAD_REQUEST]: 'The request parameters are invalid or malformed',
  [ErrorCodes.UNAUTHORIZED]: 'Authentication credentials are required',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to access this resource',
  [ErrorCodes.NOT_FOUND]: 'The requested resource could not be found',
  [ErrorCodes.VALIDATION_ERROR]: 'The provided data failed validation checks',
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred while processing your request',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Request rate limit has been exceeded',
  [ErrorCodes.CONFLICT]: 'The request conflicts with current state',
  [ErrorCodes.UNPROCESSABLE_ENTITY]: 'The request payload contains semantic errors'
} as const;

/**
 * Interface defining the structure of RFC 7807 Problem Details
 * @see https://datatracker.ietf.org/doc/html/rfc7807#section-3.1
 */
export interface ErrorDetails {
  /**
   * A URI reference that identifies the problem type
   */
  type: string;

  /**
   * A short, human-readable summary of the problem type
   */
  title: string;

  /**
   * The HTTP status code for this occurrence of the problem
   */
  status: number;

  /**
   * A human-readable explanation specific to this occurrence of the problem
   */
  detail: string;

  /**
   * A URI reference that identifies the specific occurrence of the problem
   */
  instance: string;
}

/**
 * Maps error codes to their corresponding HTTP status codes
 */
export const HttpStatusCodes = {
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.VALIDATION_ERROR]: 422,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.UNPROCESSABLE_ENTITY]: 422
} as const;

/**
 * Base URI for problem type identification
 * Should be updated to match the actual API documentation URL
 */
export const PROBLEM_BASE_URI = 'https://api.membo.ai/problems';

/**
 * Creates a fully qualified problem type URI
 */
export const getProblemTypeUri = (errorCode: ErrorCodes): string => {
  return `${PROBLEM_BASE_URI}/${errorCode.toLowerCase()}`;
};

/**
 * Factory function to create RFC 7807 compliant error details
 */
export const createErrorDetails = (
  errorCode: ErrorCodes,
  detail: string,
  instance: string
): ErrorDetails => {
  return {
    type: getProblemTypeUri(errorCode),
    title: ErrorMessages[errorCode],
    status: HttpStatusCodes[errorCode],
    detail,
    instance
  };
};

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    type: 'https://api.membo.ai/problems/auth/invalid-credentials',
    title: 'Invalid credentials',
    status: 401,
    detail: 'The provided email or password is incorrect'
  },
  ACCOUNT_LOCKED: {
    type: 'https://api.membo.ai/problems/auth/account-locked',
    title: 'Account locked',
    status: 401,
    detail: 'Account is temporarily locked due to too many failed attempts'
  },
  USER_NOT_FOUND: {
    type: 'https://api.membo.ai/problems/auth/user-not-found',
    title: 'User not found',
    status: 401,
    detail: 'No user found with the provided email'
  }
} as const;
