import { Request, Response, NextFunction } from 'express'; // version: ^4.18.2
import { ErrorCodes, ErrorMessages } from '../../constants/errorCodes';
import { logger } from '../../config/logger';

/**
 * Interface for API errors following RFC 7807 Problem Details standard
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
interface ApiError extends Error {
  status?: number;
  type?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, unknown>;
  isOperational?: boolean;
  instance?: string;
  extensions?: Record<string, unknown>;
}

/**
 * Express error handling middleware implementing RFC 7807 Problem Details
 * Provides consistent error responses with environment-aware details
 */
const errorMiddleware = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default to internal server error if status is not set
  const status = error.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error with appropriate severity
  if (status >= 500) {
    logger.error('Server error:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id']
    });
  } else {
    logger.warn('Client error:', {
      error: error.message,
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id']
    });
  }

  // Determine error type and code
  let errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
  switch (status) {
    case 400:
      errorCode = ErrorCodes.BAD_REQUEST;
      break;
    case 401:
      errorCode = ErrorCodes.UNAUTHORIZED;
      break;
    case 403:
      errorCode = ErrorCodes.FORBIDDEN;
      break;
    case 422:
      errorCode = ErrorCodes.VALIDATION_ERROR;
      break;
  }

  // Construct RFC 7807 Problem Details object
  const problemDetails: Record<string, unknown> = {
    type: error.type || `https://api.membo.ai/problems/${errorCode.toLowerCase()}`,
    title: error.title || ErrorMessages[errorCode],
    status,
    detail: isDevelopment ? error.message : ErrorMessages[errorCode],
    instance: error.instance || req.originalUrl,
  };

  // Add validation errors if present
  if (error.errors) {
    problemDetails.errors = error.errors;
  }

  // Include stack trace only in development
  if (isDevelopment && error.stack) {
    problemDetails.stack = error.stack;
  }

  // Add request identifier for error tracking
  if (req.headers['x-request-id']) {
    problemDetails.requestId = req.headers['x-request-id'];
  }

  // Add any additional context that might be helpful for debugging
  if (error.extensions) {
    problemDetails.extensions = error.extensions;
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Send RFC 7807 response with correct content-type
  res
    .status(status)
    .setHeader('Content-Type', 'application/problem+json')
    .json(problemDetails);
};

export default errorMiddleware;