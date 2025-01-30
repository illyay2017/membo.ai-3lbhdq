/**
 * @fileoverview Type definitions for authentication-related interfaces including login credentials,
 * registration data, authentication responses, and token types. These types support the JWT-based
 * authentication flow with Supabase and implement role-based access control.
 */

import { UserRole } from '@shared/types/userRoles';

/**
 * Interface defining the required credentials for user login.
 * Used as the payload for login requests to the authentication service.
 */
export interface LoginCredentials {
    /** User's email address for authentication */
    email: string;
    /** User's password for authentication */
    password: string;
}

/**
 * Interface defining the required data for new user registration.
 * Used as the payload for registration requests to create new user accounts.
 */
export interface RegisterCredentials {
    /** User's email address for account creation */
    email: string;
    /** User's password for account security */
    password: string;
    /** User's first name for profile information */
    firstName: string;
    /** User's last name for profile information */
    lastName: string;
    /** User's captcha token for registration */
    captchaToken?: string;
}

/**
 * Interface defining the structure of authentication tokens.
 * Implements JWT token management with expiry and refresh mechanisms.
 */
export interface AuthTokens {
    /** JWT access token for API authorization */
    accessToken: string;
    /** JWT refresh token for obtaining new access tokens */
    refreshToken?: string;
    /** Token expiration time in seconds (30 minutes) */
    expiresIn?: number;
}

/**
 * Interface defining the complete user profile data including verification status.
 * Used for storing and managing user information throughout the application.
 */
export interface UserData {
    /** Unique user identifier from the authentication system */
    id: string;
    /** User's verified email address */
    email: string;
    /** User's first name */
    firstName: string;
    /** User's last name */
    lastName: string;
    /** User's role for role-based access control */
    role: UserRole;
    /** Indicates whether the user's email has been verified */
    isEmailVerified?: boolean;
}

/**
 * Interface defining the complete authentication response structure.
 * Returned after successful authentication containing user data and tokens.
 */
export interface AuthResponse {
    /** Authenticated user's profile data */
    user: UserData;
    /** Authentication tokens for API access */
    tokens: AuthTokens;
    /** Token for backward compatibility */
    token: string;
}
