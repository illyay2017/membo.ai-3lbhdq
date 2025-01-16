/**
 * @fileoverview Enhanced user routes configuration with comprehensive security features
 * including XSS protection, SQL injection prevention, and role-based access control.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import winston from 'winston'; // ^3.8.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { UserController } from '../controllers/UserController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { UserRole } from '../../constants/userRoles';

// Initialize secure router with enhanced protections
const router: Router = express.Router();

// Configure security headers
router.use(helmet());

// Configure security audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-routes' },
  transports: [
    new winston.transports.File({ filename: 'logs/user-security.log' })
  ]
});

// Rate limiting configuration based on user roles
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_REQUESTS_PER_WINDOW = {
  [UserRole.FREE_USER]: 100,
  [UserRole.PRO_USER]: 1000,
  [UserRole.POWER_USER]: 5000,
  [UserRole.ENTERPRISE_ADMIN]: 10000,
  [UserRole.SYSTEM_ADMIN]: Infinity
};

// Create dynamic rate limiter based on user role
const createRoleLimiter = (maxRequests: number) => rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: maxRequests,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
    type: 'https://api.membo.ai/problems/rate-limit-exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Basic rate limiter for public endpoints
const publicLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 30,
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again later.',
    type: 'https://api.membo.ai/problems/rate-limit-exceeded'
  }
});

/**
 * Public Routes
 */

// User registration with enhanced validation and rate limiting
router.post(
  '/register',
  publicLimiter,
  validateRequest,
  async (req, res, next) => {
    try {
      auditLogger.info('Registration attempt', { ip: req.ip });
      await UserController.register(req, res, next);
    } catch (error) {
      auditLogger.error('Registration failed', { error, ip: req.ip });
      next(error);
    }
  }
);

// User login with brute force protection
router.post(
  '/login',
  publicLimiter,
  validateRequest,
  async (req, res, next) => {
    try {
      auditLogger.info('Login attempt', { ip: req.ip });
      await UserController.login(req, res, next);
    } catch (error) {
      auditLogger.error('Login failed', { error, ip: req.ip });
      next(error);
    }
  }
);

// Token refresh with rate limiting
router.post(
  '/refresh-token',
  publicLimiter,
  async (req, res, next) => {
    try {
      await UserController.refreshToken(req, res, next);
    } catch (error) {
      auditLogger.error('Token refresh failed', { error, ip: req.ip });
      next(error);
    }
  }
);

// Email verification
router.get(
  '/verify-email/:token',
  publicLimiter,
  async (req, res, next) => {
    try {
      await UserController.verifyEmail(req, res, next);
    } catch (error) {
      auditLogger.error('Email verification failed', { error, ip: req.ip });
      next(error);
    }
  }
);

/**
 * Protected Routes
 */

// Update user profile with role-based rate limiting
router.put(
  '/profile',
  authenticate,
  validateRequest,
  (req, res, next) => {
    const limiter = createRoleLimiter(MAX_REQUESTS_PER_WINDOW[req.user.role]);
    limiter(req, res, async () => {
      try {
        await UserController.updateProfile(req, res, next);
      } catch (error) {
        auditLogger.error('Profile update failed', {
          error,
          userId: req.user.id
        });
        next(error);
      }
    });
  }
);

// Update user preferences with role-based access control
router.put(
  '/preferences',
  authenticate,
  validateRequest,
  (req, res, next) => {
    const limiter = createRoleLimiter(MAX_REQUESTS_PER_WINDOW[req.user.role]);
    limiter(req, res, async () => {
      try {
        await UserController.updatePreferences(req, res, next);
      } catch (error) {
        auditLogger.error('Preferences update failed', {
          error,
          userId: req.user.id
        });
        next(error);
      }
    });
  }
);

/**
 * Admin Routes
 */

// Get all users (admin only)
router.get(
  '/admin/users',
  authenticate,
  authorize([UserRole.ENTERPRISE_ADMIN, UserRole.SYSTEM_ADMIN]),
  async (req, res, next) => {
    try {
      auditLogger.info('Admin user list accessed', {
        adminId: req.user.id,
        role: req.user.role
      });
      await UserController.getAllUsers(req, res, next);
    } catch (error) {
      auditLogger.error('Admin user list access failed', {
        error,
        adminId: req.user.id
      });
      next(error);
    }
  }
);

// Disable user account (admin only)
router.post(
  '/admin/users/:userId/disable',
  authenticate,
  authorize([UserRole.ENTERPRISE_ADMIN, UserRole.SYSTEM_ADMIN]),
  async (req, res, next) => {
    try {
      auditLogger.info('User account disable attempt', {
        adminId: req.user.id,
        targetUserId: req.params.userId
      });
      await UserController.disableUser(req, res, next);
    } catch (error) {
      auditLogger.error('User account disable failed', {
        error,
        adminId: req.user.id,
        targetUserId: req.params.userId
      });
      next(error);
    }
  }
);

export default router;