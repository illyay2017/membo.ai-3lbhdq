/**
 * Custom React hook that provides secure authentication functionality and user session management
 * Implements JWT-based authentication with automatic token refresh and comprehensive error handling
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // v18.2.0
import { AuthError } from '@supabase/supabase-js'; // v2.0.0
import { useAuthStore } from '../store/authStore';
import { LoginCredentials, RegisterCredentials, UserData } from '../types/auth';

// Constants for token refresh and retry configuration
const REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Custom hook for authentication state and operations
 * Implements automatic token refresh and secure session management
 */
export function useAuth() {
  // Extract auth state and methods from global store
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginUser,
    registerUser,
    logoutUser,
    refreshUserSession,
    setError
  } = useAuthStore();

  // Reference for refresh interval
  let refreshIntervalId: NodeJS.Timeout | null = null;

  /**
   * Handles user login with comprehensive error handling
   * @param credentials User login credentials
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Validate input credentials
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid login credentials');
      }

      // Attempt login
      await loginUser(credentials);

      // Setup token refresh interval
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }
      refreshIntervalId = setInterval(() => {
        refreshUserSession().catch((error) => {
          console.error('Token refresh failed:', error);
          handleLogout();
        });
      }, REFRESH_INTERVAL);

    } catch (error) {
      const authError = error as AuthError;
      setError(authError.message);
      throw authError;
    }
  }, [loginUser, refreshUserSession, setError]);

  /**
   * Handles new user registration with validation
   * @param credentials User registration data
   */
  const handleRegister = useCallback(async (credentials: RegisterCredentials): Promise<void> => {
    try {
      // Validate registration data
      if (!credentials.email || !credentials.password || 
          !credentials.firstName || !credentials.lastName) {
        throw new Error('Invalid registration data');
      }

      // Attempt registration
      await registerUser(credentials);

      // Setup token refresh interval
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }
      refreshIntervalId = setInterval(() => {
        refreshUserSession().catch((error) => {
          console.error('Token refresh failed:', error);
          handleLogout();
        });
      }, REFRESH_INTERVAL);

    } catch (error) {
      const authError = error as AuthError;
      setError(authError.message);
      throw authError;
    }
  }, [registerUser, refreshUserSession, setError]);

  /**
   * Handles user logout with cleanup
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      // Clear refresh interval
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }

      // Perform logout
      await logoutUser();

    } catch (error) {
      const authError = error as AuthError;
      setError(authError.message);
      throw authError;
    }
  }, [logoutUser, setError]);

  // Setup automatic token refresh on mount
  useEffect(() => {
    if (isAuthenticated) {
      refreshIntervalId = setInterval(() => {
        refreshUserSession().catch((error) => {
          console.error('Token refresh failed:', error);
          handleLogout();
        });
      }, REFRESH_INTERVAL);
    }

    // Cleanup on unmount
    return () => {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }
    };
  }, [isAuthenticated, refreshUserSession, handleLogout]);

  // Return authentication state and methods
  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout
  };
}

// Type exports for consumers
export type { UserData };