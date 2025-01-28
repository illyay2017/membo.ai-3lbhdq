/**
 * @fileoverview Defines the user role enumeration for role-based access control (RBAC)
 * within the membo.ai system. These roles represent different access levels and 
 * permissions used throughout the application for authorization and security controls.
 */

import { UserRole, DEFAULT_ROLE_PERMISSIONS } from '@shared/types/userRoles';

/**
 * Enumeration of all possible user roles in the system with their corresponding
 * permission levels. Used for role-based access control throughout the application.
 * Values are immutable and type-safe.
 * 
 * Rate Limits:
 * - FREE_USER: 100 requests/min
 * - PRO_USER: 1000 requests/min
 * - POWER_USER and above: Custom limits
 */
export const enum UserRole {
    /**
     * Basic user with limited access.
     * Permissions:
     * - Access own content only
     * - Create manual cards
     * - Basic study mode access
     * - Rate limited to 100 requests/min
     */
    FREE_USER = 'FREE_USER',

    /**
     * Paid tier user with enhanced access.
     * Additional capabilities:
     * - AI card generation
     * - All study modes
     * - Limited AI credits
     * - Rate limited to 1000 requests/min
     */
    PRO_USER = 'PRO_USER',

    /**
     * Premium user with advanced access.
     * Additional capabilities:
     * - Shared content access
     * - Full card management
     * - Quiz mode access
     * - Full AI credits
     * - Custom rate limits
     */
    POWER_USER = 'POWER_USER',

    /**
     * Organization administrator with elevated access.
     * Management capabilities:
     * - All organization content
     * - User accounts
     * - Custom AI limits
     * - Analytics
     * - Custom rate limits
     */
    ENTERPRISE_ADMIN = 'ENTERPRISE_ADMIN',

    /**
     * System administrator with full access.
     * Unrestricted access to:
     * - All features
     * - Administrative functions
     * - System settings
     * - User management
     * - No rate limits
     */
    SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

// Re-export for backend usage
export { UserRole, DEFAULT_ROLE_PERMISSIONS };

// Backend-specific role utilities
export const hasPermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
    const roleValues = Object.values(UserRole);
    const userRoleIndex = roleValues.indexOf(userRole);
    const requiredRoleIndex = roleValues.indexOf(requiredRole);
    return userRoleIndex >= requiredRoleIndex;
};
