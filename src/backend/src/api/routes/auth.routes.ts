/**
 * @fileoverview Authentication routes configuration implementing secure JWT-based
 * authentication flow with comprehensive validation and RFC 7807 error handling.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { AuthController } from '../controllers/AuthController';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { authenticate } from '../middlewares/auth.middleware';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';

// Initialize Redis client for rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.NODE_ENV === 'production',
    rejectUnauthorized: true
  }
});

// Configure rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit_auth',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '900'), // 15 minutes
  blockDuration: 900, // Block for 15 minutes
});

// Initialize router with strict options
const router = Router({
  caseSensitive: true,
  strict: true,
  mergeParams: false
});

// Connect Redis client
redisClient.connect().catch(console.error);

/**
 * POST /api/auth/register
 * User registration endpoint with validation and rate limiting
 */
router.post('/register', async (req, res) => {
  try {
    // Add security metadata
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'],
      geoLocation: {
        country: req.headers['cf-ipcountry'],
        region: req.headers['cf-region']
      }
    };

    // Validate registration request
    const validationResult = await validateRegistrationRequest({
      ...req.body,
      metadata
    });

    if (!validationResult.isValid) {
      return res.status(422).json(createErrorDetails(
        ErrorCodes.VALIDATION_ERROR,
        validationResult.errors[0].message,
        req.originalUrl
      ));
    }

    // Check rate limiting
    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many registration attempts. Please try again later.',
        req.originalUrl
      ));
    }

    // Process registration
    const authController = new AuthController(req.app.locals.authService, rateLimiter);
    const result = await authController.register(req, res);
    return result;
  } catch (error) {
    return res.status(500).json(createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Registration failed. Please try again later.',
      req.originalUrl
    ));
  }
});

/**
 * POST /api/auth/login
 * User login endpoint with validation and rate limiting
 */
router.post('/login', async (req, res) => {
  try {
    // Add security metadata
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id']
    };

    // Validate login request
    const validationResult = await validateLoginRequest({
      ...req.body,
      metadata
    });

    if (!validationResult.isValid) {
      return res.status(422).json(createErrorDetails(
        ErrorCodes.VALIDATION_ERROR,
        validationResult.errors[0].message,
        req.originalUrl
      ));
    }

    // Check rate limiting
    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many login attempts. Please try again later.',
        req.originalUrl
      ));
    }

    // Process login
    const authController = new AuthController(req.app.locals.authService, rateLimiter);
    const result = await authController.login(req, res);
    return result;
  } catch (error) {
    return res.status(500).json(createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Login failed. Please try again later.',
      req.originalUrl
    ));
  }
});

/**
 * POST /api/auth/refresh-token
 * Token refresh endpoint with authentication
 */
router.post('/refresh-token', authenticate, async (req, res) => {
  try {
    const authController = new AuthController(req.app.locals.authService, rateLimiter);
    const result = await authController.refreshToken(req, res);
    return result;
  } catch (error) {
    return res.status(401).json(createErrorDetails(
      ErrorCodes.UNAUTHORIZED,
      'Token refresh failed. Please login again.',
      req.originalUrl
    ));
  }
});

/**
 * POST /api/auth/logout
 * Secure logout endpoint with token invalidation
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const authController = new AuthController(req.app.locals.authService, rateLimiter);
    const result = await authController.logout(req, res);
    return result;
  } catch (error) {
    return res.status(500).json(createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Logout failed. Please try again later.',
      req.originalUrl
    ));
  }
});

// Apply security headers to all routes
router.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'",
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// Export configured router
export default router;