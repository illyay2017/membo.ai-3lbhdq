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
import { setAuthTokens, getAuthTokens, clearAuthTokens } from '../lib/storage';
import { api } from '../lib/api';

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
  token: string | null;
  sessionError: string | null;

  // Actions
  loginUser: (credentials: LoginCredentials) => Promise<void>;
  registerUser: (userData: RegisterCredentials) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
  setAuth: (auth: { isAuthenticated: boolean; user: UserData; token: string }) => void;
  setError: (error: string | null) => void;
  initializeAuth: () => Promise<void>;
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
  token: null,
  sessionError: null,
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
          
          if (!response.user || !response.tokens?.accessToken) {
            throw new Error('Invalid login response');
          }

          set({
            user: response.user,
            isAuthenticated: true,
            token: response.tokens.accessToken,
            sessionExpiresAt: Date.now() + (response.tokens.expiresIn * 1000),
            isLoading: false
          });

          useUIStore.getState().showToast({
            type: 'success',
            message: 'Successfully logged in'
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false 
          });
          throw error;
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
          const expiresAt = Date.now() + ((response.tokens?.expiresIn ?? 3600) * 1000);

          set({
            user: response.user,
            isAuthenticated: true,
            lastTokenRefresh: Date.now(),
            sessionExpiresAt: expiresAt,
            token: response.tokens?.accessToken ?? response.token,
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
          
          // Attempt server logout but don't throw if it fails
          try {
            await logout();
          } catch (error) {
            console.error('Server logout failed:', error);
          }
          
          // Always clean up local state
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
            error: error instanceof Error ? error.message : 'Logout failed',
            isLoading: false
          });
          
          useUIStore.getState().showToast({
            type: 'error',
            message: 'Failed to clean up local session'
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
            const expiresAt = Date.now() + ((response.tokens?.expiresIn ?? 3600) * 1000);

            set({
              lastTokenRefresh: Date.now(),
              sessionExpiresAt: expiresAt,
              token: response.tokens?.accessToken ?? response.token,
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
      },

      setAuth: (auth) => set(() => ({ 
        isAuthenticated: auth.isAuthenticated,
        user: auth.user,
        token: auth.token
      })),

      setError: (error) => set({ error }),

      initializeAuth: async () => {
        const tokens = getAuthTokens();
        if (tokens) {
          try {
            const response = await api.get('/auth/me', {
              headers: { Authorization: `Bearer ${tokens.accessToken}` }
            });
            set({
              isAuthenticated: true,
              user: response.data,
              token: tokens.accessToken,
              isLoading: false
            });
          } catch (error) {
            clearAuthTokens();
            set({ isAuthenticated: false, user: null, token: null, isLoading: false });
          }
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-store',
      enabled: process.env.NODE_ENV === 'development' && 
               typeof window !== 'undefined' &&
               (window as any).__REDUX_DEVTOOLS_EXTENSION__ !== undefined
    }
  )
);
