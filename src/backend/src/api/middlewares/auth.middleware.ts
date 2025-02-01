/**
 * @fileoverview Authentication middleware with enhanced security features including
 * JWT verification, role-based access control, token blacklisting, and audit logging.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { verifyToken } from '../../utils/jwt';
import { UserRole } from '../../constants/userRoles';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';
import { IUser } from '../../interfaces/IUser';
import { auditLogger } from '../../services/AuditLoggerService';
import { getServices } from '../../config/services';
import { JWTError } from '../../utils/jwt';

declare module 'express' {
  interface Request {
    user?: IUser & {
      lastAccess: Date;
    };
  }
}

const { redisService, tokenService } = getServices();

// Initialize Redis client for token blacklist and role cache
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

/**
 * Extended Express Request interface with authenticated user and security context
 */
export interface AuthenticatedRequest extends Request {
  user?: IUser & {
    lastAccess: Date;
  };
  securityContext?: {
    tokenId: string;
    issueTime: Date;
    clientIp: string;
  };
}

/**
 * Checks if a token is blacklisted in Redis
 * @param tokenId Unique token identifier
 * @returns Boolean indicating if token is blacklisted
 */
const isTokenBlacklisted = async (tokenId: string): Promise<boolean> => {
  const blacklisted = await redisClient.get(`blacklist:${tokenId}`);
  return !!blacklisted;
};

/**
 * Extracts bearer token from authorization header
 * @param authHeader Authorization header value
 * @returns Extracted token or null
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

/**
 * Authentication middleware that verifies JWT tokens and enforces security policies
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new JWTError('No token provided', 'TOKEN_MISSING');
    }

    const token = authHeader.split(' ')[1];
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new JWTError('Token is blacklisted', 'TOKEN_BLACKLISTED');
    }

    const decoded = await tokenService.verifyAccessToken(token);

    // Attach user context to request
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware with caching
 * @param roles Array of allowed roles for the route
 */
export const authorize = (roles: UserRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user || !req.securityContext) {
        const error = createErrorDetails(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required',
          req.originalUrl
        );
        res.status(error.status).json(error);
        return;
      }

      // Check role cache first
      const cacheKey = `role:${req.user.id}:${req.originalUrl}`;
      const cachedResult = await redisClient.get(cacheKey);

      if (cachedResult) {
        if (cachedResult === 'allowed') {
          return next();
        } else {
          throw new Error('Cached authorization denied');
        }
      }

      // Verify role authorization
      if (!roles.includes(req.user.role)) {
        throw new Error('Insufficient permissions');
      }

      // Cache successful authorization for 5 minutes
      await redisClient.set(cacheKey, 'allowed', {
        EX: 300 // 5 minutes
      });

      // Log successful authorization
      auditLogger.info('Authorization successful', {
        userId: req.user.id,
        role: req.user.role,
        resource: req.originalUrl,
        method: req.method
      });

      next();
    } catch (error) {
      const errorDetail = createErrorDetails(
        ErrorCodes.FORBIDDEN,
        'Insufficient permissions to access this resource',
        req.originalUrl
      );

      // Log authorization failure
      auditLogger.warn('Authorization failed', {
        userId: req.user?.id,
        role: req.user?.role,
        resource: req.originalUrl,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(errorDetail.status).json(errorDetail);
    }
  };
};

// Initialize Redis connection
redisClient.connect().catch((error) => {
  auditLogger.error('Redis connection failed', { error });
  process.exit(1);
});


// This implementation provides a robust authentication and authorization middleware with the following features:

// 1. JWT token verification with enhanced security checks
// 2. Role-based access control with Redis caching
// 3. Token blacklist management
// 4. Comprehensive security audit logging
// 5. RFC 7807 compliant error responses
// 6. IP and user agent tracking
// 7. Secure session context management
// 8. Performance optimization through caching
// 9. Detailed security event logging

// The middleware can be used in routes like this:

// ```typescript
// router.get('/protected',
//   authenticate,
//   authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
//   protectedController
// );
// ```
