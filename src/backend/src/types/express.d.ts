/**
 * @fileoverview Type declarations extending Express Request interface to include
 * custom types for authenticated users, request validation, and rate limiting
 * throughout the membo.ai backend application.
 */

import { IUser } from '../interfaces/IUser';
import { Express } from 'express-serve-static-core';

/**
 * Type definition for validation errors in request processing
 */
export type ValidationError = {
    field: string;
    message: string;
};

/**
 * Type definition for rate limiting information including request quotas
 * and reset timing based on user roles:
 * - FREE_USER: 100 requests/min
 * - PRO_USER: 1000 requests/min
 * - POWER_USER and above: Custom limits
 */
export type RateLimitInfo = {
    /** Maximum number of requests allowed per time window */
    limit: number;
    /** Current count of requests made */
    current: number;
    /** Number of requests remaining in current window */
    remaining: number;
    /** Timestamp when the rate limit window resets */
    resetTime: Date;
};

declare global {
    namespace Express {
        /**
         * Extended Express Request interface with custom properties for
         * authentication, validation, and rate limiting
         */
        interface Request {
            /**
             * Authenticated user information from JWT token verification.
             * Undefined if request is not authenticated.
             */
            user?: IUser & { lastAccess: Date };

            /**
             * Validated and sanitized request data after middleware processing.
             * Type varies based on endpoint requirements.
             */
            validatedData: any;

            /**
             * Rate limiting information for the current request context.
             * Limits vary based on user role as defined in UserRole enum.
             */
            rateLimit: RateLimitInfo;
        }

        /**
         * Type for requests that require authentication
         */
        interface AuthenticatedRequest extends Request {
            user: IUser & { lastAccess: Date };
        }
    }
}

// Export the Express namespace to ensure type augmentation is picked up
export {};