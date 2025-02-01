/**
 * @fileoverview Authentication routes configuration implementing secure JWT-based
 * authentication flow with comprehensive validation and RFC 7807 error handling.
 * @version 1.0.0
 */

import { Router, Response, Request, NextFunction } from 'express'; // ^4.18.2
import { AuthController } from '../controllers/AuthController';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { authenticate } from '../middlewares/auth.middleware';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rateLimiter.middleware';
import { getServices } from '../../config/services';

// At the top of the file, add debug logging
console.log('Loading auth.routes.ts');

// Initialize router with strict options
const router = Router({
  caseSensitive: true,
  strict: true,
  mergeParams: false
});

// Get services once during initialization
const { authService, rateLimiterService } = getServices();
const authController = new AuthController(authService);

// Security headers middleware - apply first
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

// Debug logging middleware
router.use((req, res, next) => {
  console.log('Request in auth.routes.ts:', {
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    ip: req.ip,
    headers: {
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'],
      country: req.headers['cf-ipcountry'],
      region: req.headers['cf-region']
    }
  });
  next();
});

console.log('Setting up auth routes...');

interface AuthRequestParams {}

interface AuthRequestBody {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  captchaToken?: string;
  metadata?: {
    ipAddress: string;
    userAgent?: string;
    deviceId?: string;
  };
}

interface AuthRequestQuery {}

interface AuthResponse {
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  message?: string;
  error?: string;
  code?: string;
  type?: string;
  details?: unknown;
  path?: string;
}

// Shared rate limit middleware with proper typing
const rateLimit = async (
  req: Request<AuthRequestParams, AuthResponse, AuthRequestBody, AuthRequestQuery>,
  res: Response<AuthResponse>,
  next: NextFunction,
  endpoint: 'login' | 'register' | 'refresh'
) => {
  const ipAddress = String(req.ip || req.socket?.remoteAddress || 'unknown_ip');
  const key = `auth:${endpoint}:${ipAddress}`;
  
  try {
    const isAllowed = await rateLimiterService.checkRateLimit(key, 100, 15 * 60 * 1000, {
      blockDuration: 15 * 60 * 1000,
      prefix: 'auth'
    });

    if (!isAllowed) {
      console.warn(`Rate limit exceeded for ${endpoint}:`, { ip: ipAddress });
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Too many ${endpoint} attempts. Please try again later.`,
        req.originalUrl
      ));
    }
    next();
    return undefined;
  } catch (error) {
    console.error(`Rate limit check failed for ${endpoint}:`, {
      error,
      ip: ipAddress
    });
    next(error);
    return undefined;
  }
};

// Shared metadata collection
const collectMetadata = (req: Request) => ({
  ipAddress: String(req.ip || req.socket?.remoteAddress || 'unknown_ip'),
  userAgent: req.headers['user-agent'],
  deviceId: req.headers['x-device-id'],
  geoLocation: {
    country: req.headers['cf-ipcountry'],
    region: req.headers['cf-region']
  },
  timestamp: new Date().toISOString()
});

/**
 * POST /api/auth/register
 * User registration endpoint with validation and rate limiting
 */
router.post('/register', 
  (req, res, next) => rateLimit(req, res, next, 'register'),
  async (req, res) => {
    try {
      const metadata = collectMetadata(req);
      console.log('Registration request received:', {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        metadata
      });

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

      return authController.register(req, res);
    } catch (error) {
      console.error('Registration error:', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        path: req.originalUrl
      });

      return res.status(500).json(createErrorDetails(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Registration failed. Please try again later.',
        req.originalUrl,
        error instanceof Error ? error.message : undefined
      ));
    }
  }
);

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

    next();
    return;
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
    // Use RateLimiterService instead of direct Redis
    const ipAddress = String(req.ip || req.socket?.remoteAddress || 'unknown_ip');
    const isAllowed = await rateLimiterService.checkRateLimit(
      `auth:login:${ipAddress}`,
      100,  // max attempts
      15 * 60 * 1000,  // 15 minute window
      { blockDuration: 15 * 60 * 1000 }
    );

    if (!isAllowed) {
      console.error('Rate limit error:', Error);
      return res.status(429).json(createErrorDetails(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many login attempts. Please try again later.',
        req.originalUrl
      ));
    }

    // Use the initialized authService
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
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  return authController.logout(req, res);
});

console.log('Auth routes configured:', router.stack.map(r => ({
  path: r.route?.path,
  methods: r.route?.stack[0]?.method || []  // Access method from route stack
})));

// Export configured router
export default router;
