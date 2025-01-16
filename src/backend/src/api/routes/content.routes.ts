/**
 * @fileoverview Express router configuration for content-related API endpoints.
 * Implements secure, monitored and performant routes with comprehensive middleware chains.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.17.17
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { ContentController } from '../controllers/ContentController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateContent } from '../validators/content.validator';
import { UserRole } from '../../constants/userRoles';
import { createErrorDetails, ErrorCodes } from '../../constants/errorCodes';

// Rate limit configurations based on user roles
const rateLimiters = {
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
  default: rateLimit({
    windowMs: 60 * 1000,
    max: 2000,
    message: createErrorDetails(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      '/api/v1/content'
    )
  })
};

/**
 * Configures and returns Express router with secure content endpoints
 * @param contentController Initialized ContentController instance
 * @returns Configured Express router
 */
export default function configureContentRoutes(contentController: ContentController): Router {
  const router = Router({ strict: true });

  // Apply compression for response optimization
  router.use(compression());

  // POST /content - Create new content
  router.post('/',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = rateLimiters[req.user?.role as UserRole] || rateLimiters.default;
      return limiter(req, res, next);
    },
    validateContent,
    contentController.createContent
  );

  // GET /content - Get user's content with pagination and filtering
  router.get('/',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = rateLimiters[req.user?.role as UserRole] || rateLimiters.default;
      return limiter(req, res, next);
    },
    contentController.getUserContent
  );

  // GET /content/:id - Get specific content by ID
  router.get('/:id',
    authenticate,
    authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = rateLimiters[req.user?.role as UserRole] || rateLimiters.default;
      return limiter(req, res, next);
    },
    contentController.getContent
  );

  // PATCH /content/:id/archive - Archive content
  router.patch('/:id/archive',
    authenticate,
    authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = rateLimiters[req.user?.role as UserRole] || rateLimiters.default;
      return limiter(req, res, next);
    },
    contentController.archiveContent
  );

  // DELETE /content/:id - Delete content
  router.delete('/:id',
    authenticate,
    authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
    (req, res, next) => {
      const limiter = rateLimiters[req.user?.role as UserRole] || rateLimiters.default;
      return limiter(req, res, next);
    },
    contentController.deleteContent
  );

  // Error handling middleware
  router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Content Route Error:', err);
    
    const errorDetail = createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'An error occurred while processing the content request',
      req.originalUrl
    );

    res.status(errorDetail.status).json(errorDetail);
  });

  return router;
}