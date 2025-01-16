/**
 * Global authentication state management store using Zustand
 * Implements JWT-based authentication with Supabase, session management,
 * and role-based access control for membo.ai web application
 * @version 1.0.0
 */

import { create } from 'zustand'; // v4.4.1
import { devtools } from 'zustand/middleware'; // v4.4.1
import { login, register, logout, refreshToken } from '../services/authService';
import { LoginCredentials, RegisterCredentials, UserData } from '../types/auth';
import { useUIStore } from './uiStore';

/**
 * Interface defining the authentication store state and actions
 */
interface IAuthStore {
  // State
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastTokenRefresh: number | null;
  sessionExpiresAt: number | null;

  // Actions
  loginUser: (credentials: LoginCredentials) => Promise<void>;
  registerUser: (userData: RegisterCredentials) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
}

/**
 * Constants for authentication configuration
 */
const INITIAL_STATE = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastTokenRefresh: null,
  sessionExpiresAt: null,
} as const;

const TOKEN_REFRESH_THRESHOLD = 300; // 5 minutes before expiry in seconds
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_RETRY_DELAY = 1000; // 1 second delay between retries

/**
 * Create the authentication store with devtools middleware
 */
export const useAuthStore = create<IAuthStore>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      /**
       * Authenticates user with provided credentials
       * @param credentials User login credentials
       */
      loginUser: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true, error: null });

          const response = await login(credentials);
          const expiresAt = Date.now() + (response.tokens.expiresIn * 1000);

          set({
            user: response.user,
            isAuthenticated: true,
            lastTokenRefresh: Date.now(),
            sessionExpiresAt: expiresAt,
          });

          // Initialize token refresh cycle
          const timeUntilRefresh = (expiresAt - Date.now()) - (TOKEN_REFRESH_THRESHOLD * 1000);
          setTimeout(() => get().refreshUserSession(), timeUntilRefresh);

          useUIStore.getState().showToast({
            type: 'success',
            message: 'Successfully logged in'
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Login failed' });
          useUIStore.getState().showToast({
            type: 'error',
            message: 'Login failed. Please try again.'
          });
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Registers new user account
       * @param userData User registration data
       */
      registerUser: async (userData: RegisterCredentials) => {
        try {
          set({ isLoading: true, error: null });

          const response = await register(userData);
          const expiresAt = Date.now() + (response.tokens.expiresIn * 1000);

          set({
            user: response.user,
            isAuthenticated: true,
            lastTokenRefresh: Date.now(),
            sessionExpiresAt: expiresAt,
          });

          // Initialize token refresh cycle
          const timeUntilRefresh = (expiresAt - Date.now()) - (TOKEN_REFRESH_THRESHOLD * 1000);
          setTimeout(() => get().refreshUserSession(), timeUntilRefresh);

          useUIStore.getState().showToast({
            type: 'success',
            message: 'Account created successfully'
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Registration failed' });
          useUIStore.getState().showToast({
            type: 'error',
            message: 'Registration failed. Please try again.'
          });
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Logs out current user and cleans up session state
       */
      logoutUser: async () => {
        try {
          set({ isLoading: true });
          await logout();
          
          set({
            ...INITIAL_STATE,
            isLoading: false
          });

          useUIStore.getState().showToast({
            type: 'success',
            message: 'Successfully logged out'
          });
        } catch (error) {
          set({
            ...INITIAL_STATE,
            error: error instanceof Error ? error.message : 'Logout failed',
            isLoading: false
          });
        }
      },

      /**
       * Refreshes user session before token expiration
       */
      refreshUserSession: async () => {
        const state = get();
        if (!state.sessionExpiresAt) return;

        const timeUntilExpiry = state.sessionExpiresAt - Date.now();
        if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD * 1000) return;

        let attempts = 0;
        while (attempts < MAX_REFRESH_ATTEMPTS) {
          try {
            const response = await refreshToken();
            const expiresAt = Date.now() + (response.tokens.expiresIn * 1000);

            set({
              lastTokenRefresh: Date.now(),
              sessionExpiresAt: expiresAt,
            });

            // Schedule next refresh
            const timeUntilNextRefresh = (expiresAt - Date.now()) - (TOKEN_REFRESH_THRESHOLD * 1000);
            setTimeout(() => get().refreshUserSession(), timeUntilNextRefresh);

            return;
          } catch (error) {
            attempts++;
            if (attempts === MAX_REFRESH_ATTEMPTS) {
              await get().logoutUser();
              useUIStore.getState().showToast({
                type: 'error',
                message: 'Session expired. Please login again.'
              });
              return;
            }
            await new Promise(resolve => setTimeout(resolve, REFRESH_RETRY_DELAY));
          }
        }
      }
    }),
    {
      name: 'auth-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);