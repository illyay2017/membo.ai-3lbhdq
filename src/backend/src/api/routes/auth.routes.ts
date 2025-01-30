/**
 * @fileoverview Authentication routes configuration implementing secure JWT-based
 * authentication flow with comprehensive validation and RFC 7807 error handling.
 * @version 1.0.0
 */

import { Router, Response } from 'express'; // ^4.18.2
import { AuthController } from '../controllers/AuthController';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { authenticate } from '../middlewares/auth.middleware';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';
import { AuthService, clearUserSession } from '../../services/AuthService';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// At the top of the file, add debug logging
console.log('Loading auth.routes.ts');

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

// Debug middleware for auth routes specifically
router.use((req, res, next) => {
  console.log('Request in auth.routes.ts:', {
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
  next();
});

// Connect Redis client
redisClient.connect().catch(console.error);

// After Redis client initialization
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Test Redis connection
redisClient.ping().then(() => {
  console.log('Redis PING successful');
}).catch((err) => {
  console.error('Redis PING failed:', err);
});

// Initialize AuthService
const authService = new AuthService();

console.log('Setting up auth routes...');

/**
 * POST /api/auth/register
 * User registration endpoint with validation and rate limiting
 */
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', {
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      hasPassword: !!req.body.password,
      hasCaptcha: !!req.body.captchaToken
    });

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

    console.log('Request metadata:', metadata);

    // Validate registration request
    const validationResult = await validateRegistrationRequest({
      ...req.body,
      metadata
    });

    console.log('Validation result:', {
      isValid: validationResult.isValid,
      errors: validationResult.errors
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
      const ipAddress = String(req.ip || req.socket?.remoteAddress || 'unknown_ip');
      await rateLimiter.consume(ipAddress);
    } catch (error) {
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many registration attempts. Please try again later.',
        req.originalUrl
      ));
    }

    // Process registration
    const authController = new AuthController(authService, rateLimiter);
    const result = await authController.register(req, res);
    return result;
  } catch (error) {
    console.error('Registration error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });

    return res.status(500).json(createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Registration failed. Please try again later.',
      req.originalUrl,
      error instanceof Error ? error.message : undefined
    ));
  }
});

/**
 * POST /api/auth/login
 * User login endpoint with validation and rate limiting
 */
router.post('/login', async (req, res, next) => {
  console.log('Login request received in auth.routes.ts');
  try {
    // Add metadata before validation
    req.body = {
      ...req.body,
      metadata: {
        ipAddress: String(req.ip || req.socket?.remoteAddress || 'unknown_ip'),
        userAgent: req.headers['user-agent'],
        deviceId: req.headers['x-device-id']
      }
    };

    const validationResult = await validateLoginRequest(req.body);

    if (!validationResult.isValid) {
      return res.status(422).json(createErrorDetails(
        ErrorCodes.VALIDATION_ERROR,
        validationResult.errors[0].message,
        req.originalUrl
      ));
    }

    return next();
  } catch (error) {
    // Enhanced error logging
    console.error('Login error details:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      path: req.originalUrl,
      body: { ...req.body, password: '[REDACTED]' }
    });

    return res.status(500).json(createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Login failed. Please try again later.',
      req.originalUrl
    ));
  }
}, async (req, res) => {
  try {
    // Check rate limiting
    try {
      const ipAddress = String(req.ip || req.socket?.remoteAddress || 'unknown_ip');
      await rateLimiter.consume(ipAddress);
    } catch (error) {
      console.error('Rate limit error:', error);
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many login attempts. Please try again later.',
        req.originalUrl
      ));
    }

    // Use the initialized authService
    const authController = new AuthController(authService, rateLimiter);
    const result = await authController.login(req, res);
    return result;
  } catch (error) {
    // Enhanced error logging
    console.error('Login error details:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      path: req.originalUrl,
      body: { ...req.body, password: '[REDACTED]' }
    });

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
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Add logging here
    console.log('Logout request received:', {
      user: req.user,
      token: req.headers.authorization
    });

    // Clear the token from any blacklist/storage
    if (req.user) {
      await clearUserSession(req.user.id);
    }

    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
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

console.log('Auth routes configured:', router.stack.map(r => ({
  path: r.route?.path,
  methods: r.route?.stack[0]?.method || []  // Access method from route stack
})));

// Export configured router
export default router;
