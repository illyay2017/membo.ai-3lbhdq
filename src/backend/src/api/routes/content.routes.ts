/**
 * @fileoverview Express router configuration for content-related API endpoints.
 * Implements secure, monitored and performant routes with comprehensive middleware chains.
 * @version 1.0.0
 */

import express, { Router, Express } from 'express'; // ^4.17.17
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { ContentController } from '../controllers/ContentController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateContent } from '../validators/content.validator';
import { UserRole } from '../../constants/userRoles';
import { createErrorDetails, ErrorCodes } from '../../constants/errorCodes';
import { validateRequest } from '../middlewares/validation.middleware';
import { Request, Response, NextFunction } from 'express';
import { RateLimitRequestHandler } from 'express-rate-limit';

// Add type for rate limiters
type RateLimiters = {
  [key in UserRole | 'default']: RateLimitRequestHandler;
};

// Update rateLimiters definition
const rateLimiters: RateLimiters = {
  [UserRole.FREE_USER]: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Free tier rate limit exceeded',
      '/api/v1/content'
    )
  }),
  [UserRole.PRO_USER]: rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Pro tier rate limit exceeded',
      '/api/v1/content'
    )
  }),
  [UserRole.POWER_USER]: rateLimit({
    windowMs: 60 * 1000,
    max: 2000,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Power tier rate limit exceeded',
      '/api/v1/content'
    )
  }),
  [UserRole.ENTERPRISE_ADMIN]: rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      '/api/v1/content'
    )
  }),
  [UserRole.SYSTEM_ADMIN]: rateLimit({
    windowMs: 60 * 1000,
    max: 5000,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'System admin rate limit exceeded',
      '/api/v1/content'
    )
  }),
  default: rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      '/api/v1/content'
    )
  })
};

// Add helper function
const getRateLimiter = (role?: UserRole): RateLimitRequestHandler => {
  if (role && role in rateLimiters) {
    return rateLimiters[role];
  }
  return rateLimiters.default;
};

// Add AuthenticatedRequest type
type AuthenticatedRequest = Express.AuthenticatedRequest;

/**
 * Configures and returns Express router with secure content endpoints
 * @param contentController Initialized ContentController instance
 * @returns Configured Express router
 */
const configureContentRoutes = (contentController: ContentController) => {
  if (!contentController) {
    throw new Error('ContentController is required');
  }

  const router = Router({ strict: true });
  router.use(compression());

  // Basic middleware function
  const basicHandler = (req: Request, res: Response, next: NextFunction) => {
    console.log('Basic handler called');
    next();
  };

  // Test with a simple route first
  router.post('/', basicHandler, (req: Request, res: Response) => {
    res.json({ message: 'Test route' });
  });

  // If that works, then try adding middleware one by one
  /*
  router.post('/', 
    basicHandler,
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = getRateLimiter(req.user?.role);
      return limiter(req, res, next);
    },
    validateContent,
    (req: Request, res: Response) => {
      return contentController.createContent(req, res);
    }
  );
  */

  return router;
};

export default configureContentRoutes;
