/**
 * @fileoverview Defines the core user interfaces for membo.ai, including user model structure,
 * authentication details, preferences, and role-based access control properties.
 */

import { UserRole } from '../constants/userRoles';

/**
 * Interface defining notification preferences structure for users
 */
interface INotificationPreferences {
    /** Enable/disable email notifications */
    email: boolean;
    /** Enable/disable push notifications */
    push: boolean;
    /** Enable/disable study reminder notifications */
    studyReminders: boolean;
}

/**
 * Interface defining comprehensive user preferences and settings
 */
export interface IUserPreferences {
    /** User's preferred study mode (standard, quiz, voice) */
    studyMode: 'standard' | 'quiz' | 'voice';
    /** Flag indicating if voice mode is enabled for study sessions */
    voiceEnabled: boolean;
    /** Target number of cards to study per day */
    dailyGoal: number;
    /** User's preferred theme setting */
    theme: 'light' | 'dark' | 'system';
    /** User's preferred language code (ISO 639-1) */
    language: string;
    /** User's notification preferences configuration */
    notifications: INotificationPreferences;
}

/**
 * Main interface defining the user model structure with authentication,
 * authorization, and preferences. Used for type checking and model definition
 * across the application.
 */
export interface IUser {
    /** Unique identifier for the user (UUID v4) */
    id: string;
    /** User's email address for authentication and notifications */
    email: string;
    /** Bcrypt hashed password for secure authentication */
    password: string;
    /** User's first name for personalization */
    firstName: string;
    /** User's last name for personalization */
    lastName: string;
    /** User's role for access control and feature availability */
    role: UserRole;
    /** User's application preferences and study settings */
    preferences: IUserPreferences;
    /** Timestamp of user account creation */
    createdAt: Date;
    /** Timestamp of last user profile update */
    updatedAt: Date;
    /** Timestamp of last successful login */
    lastLoginAt: Date;
    /** Flag indicating if user account is active and not suspended */
    isActive: boolean;
    /** Flag indicating if user email is verified for security */
    isEmailVerified: boolean;
    /** Schema version for handling model updates */
    version: number;
    /** Timestamp of last user access */
    lastAccess: Date;
    /** Timestamp of last password change */
    lastPasswordChangeAt: Date;
}
