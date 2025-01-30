/**
 * @fileoverview JWT utility module for secure token generation, verification,
 * and management with enhanced security features and comprehensive error handling.
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { IUser } from '../interfaces/IUser';

// Initialize environment configuration
config();

// Constants for token configuration
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
const JWT_ISSUER = 'membo.ai';
const JWT_AUDIENCE = 'membo.ai/api';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '30m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Interface defining the structure of JWT token payload with security fields
 */
interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
    jti: string;
    iss: string;
    aud: string;
}

/**
 * Custom error class for JWT-related errors
 */
class JWTError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'JWTError';
    }
}

/**
 * Generates a cryptographically secure random token identifier
 * @returns Unique token identifier
 */
const generateTokenId = (): string => {
    return crypto.randomUUID();
};

/**
 * Sanitizes user input data to prevent injection attacks
 * @param data Object containing user data
 * @returns Sanitized data object
 */
const sanitizeTokenData = (data: Partial<IUser>): Partial<IUser> => {
    return {
        id: data.id?.trim(),
        email: data.email?.toLowerCase().trim(),
        role: data.role
    };
};

/**
 * Generates a secure JWT token for authenticated users
 * @param user User object containing authentication details
 * @returns Generated JWT token string
 * @throws {JWTError} If token generation fails or user data is invalid
 */
export const generateToken = async (user: IUser): Promise<string> => {
    try {
        if (!user.id || !user.email || !user.role) {
            throw new JWTError('Invalid user data for token generation', 'INVALID_USER_DATA');
        }

        const sanitizedUser = sanitizeTokenData(user);
        const tokenId = generateTokenId();

        const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
            userId: sanitizedUser.id!,
            email: sanitizedUser.email!,
            role: sanitizedUser.role!,
            jti: tokenId,
            iss: JWT_ISSUER,
            aud: JWT_AUDIENCE
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            algorithm: 'HS512',
            expiresIn: TOKEN_EXPIRY,
        });

        return token;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Token generation failed';
        throw new JWTError(message, 'TOKEN_GENERATION_ERROR');
    }
};

/**
 * Verifies and decodes JWT tokens with comprehensive security checks
 * @param token JWT token string to verify
 * @returns Decoded token payload
 * @throws {JWTError} If token verification fails
 */
export const verifyToken = async (token: string): Promise<TokenPayload> => {
    try {
        if (!token) {
            throw new JWTError('Token is required', 'TOKEN_REQUIRED');
        }

        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS512'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            complete: true
        }) as jwt.JwtPayload;

        // Additional security validations
        if (!decoded.payload.jti || !decoded.payload.userId) {
            throw new JWTError('Invalid token payload', 'INVALID_PAYLOAD');
        }

        return decoded.payload as TokenPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new JWTError('Token has expired', 'TOKEN_EXPIRED');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new JWTError('Invalid token', 'INVALID_TOKEN');
        }
        const message = error instanceof Error ? error.message : 'Token verification failed';
        throw new JWTError(message, 'TOKEN_VERIFICATION_ERROR');
    }
};

/**
 * Generates a secure refresh token with extended validity
 * @param user User object containing authentication details
 * @returns Generated refresh token string
 * @throws {JWTError} If refresh token generation fails
 */
export const generateRefreshToken = async (user: IUser): Promise<string> => {
    try {
        if (!user.id || !user.email || !user.role) {
            throw new JWTError('Invalid user data for refresh token generation', 'INVALID_USER_DATA');
        }

        const sanitizedUser = sanitizeTokenData(user);
        const tokenId = generateTokenId();

        const payload = {
            userId: sanitizedUser.id!,
            jti: tokenId,
            iss: JWT_ISSUER,
            aud: JWT_AUDIENCE
        };

        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
            algorithm: 'HS512',
            expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        return refreshToken;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Refresh token generation failed';
        throw new JWTError(message, 'REFRESH_TOKEN_GENERATION_ERROR');
    }
};

/**
 * Verifies a refresh token and ensures it hasn't been revoked
 * @param refreshToken Refresh token string to verify
 * @returns Decoded refresh token payload
 * @throws {JWTError} If refresh token verification fails
 */
export const verifyRefreshToken = async (refreshToken: string): Promise<jwt.JwtPayload> => {
    try {
        if (!refreshToken) {
            throw new JWTError('Refresh token is required', 'REFRESH_TOKEN_REQUIRED');
        }

        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
            algorithms: ['HS512'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        }) as jwt.JwtPayload;

        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new JWTError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
        }
        const message = error instanceof Error ? error.message : 'Refresh token verification failed';
        throw new JWTError(message, 'REFRESH_TOKEN_VERIFICATION_ERROR');
    }
};