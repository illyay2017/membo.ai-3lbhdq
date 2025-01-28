/**
 * @fileoverview Authentication service for membo.ai web application
 * Implements secure JWT-based authentication with Supabase, including token management,
 * role-based access control, and proactive token refresh mechanisms.
 * @version 1.0.0
 */

import { setAuthToken, clearAuthToken } from '../lib/api';
import { setAuthTokens, clearAuthTokens } from '../lib/storage';
import { LoginCredentials, RegisterCredentials, AuthResponse, AuthTokens } from '../types/auth';
import { API_ENDPOINTS } from '../constants/api';

// Token refresh configuration
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes before expiry
const TOKEN_CHECK_INTERVAL = 60000; // Check every minute

let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Authenticates user with provided credentials
 * @param credentials - User login credentials
 * @returns Authentication response with user data and tokens
 * @throws Error if authentication fails
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // Add debug logging
    console.log('Attempting login to:', API_ENDPOINTS.AUTH.LOGIN);
    console.log('With credentials:', { email: credentials.email, password: '***' });

    const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials),
      credentials: 'include' // Important for cookies
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Error response:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response
    if (!data?.tokens?.accessToken || !data?.user) {
      throw new Error('Invalid authentication response');
    }

    // Setup authentication state
    await setupAuthState(data.tokens);

    return data;
  } catch (error) {
    console.error('Login failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Authentication failed');
  }
}

/**
 * Registers new user account with provided data
 * @param userData - User registration data
 * @returns Authentication response for new account
 * @throws Error if registration fails
 */
export async function register(userData: RegisterCredentials): Promise<AuthResponse> {
  try {
    // Validate registration data
    if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
      throw new Error('Invalid registration data');
    }

    // Validate password strength
    if (!isPasswordStrong(userData.password)) {
      throw new Error('Password does not meet security requirements');
    }

    // Attempt registration
    const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response
    if (!data?.tokens?.accessToken || !data?.user) {
      throw new Error('Invalid registration response');
    }

    // Setup authentication state
    await setupAuthState(data.tokens);

    return data;
  } catch (error) {
    console.error('Registration failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Registration failed');
  }
}

/**
 * Logs out current user and cleans up auth state
 * @throws Error if logout fails
 */
export async function logout(): Promise<void> {
  try {
    // Attempt server-side logout
    const response = await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Logout request failed:', error);
  } finally {
    // Clean up local auth state regardless of server response
    cleanupAuthState();
  }
}

/**
 * Proactively refreshes authentication token
 * @returns New authentication response with fresh tokens
 * @throws Error if refresh fails
 */
export async function refreshToken(): Promise<AuthResponse> {
  try {
    const response = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate refresh response
    if (!data?.tokens?.accessToken) {
      throw new Error('Invalid token refresh response');
    }

    // Update auth state with new tokens
    await setupAuthState(data.tokens);

    return data;
  } catch (error) {
    console.error('Token refresh failed:', error);
    cleanupAuthState();
    throw new Error('Session expired. Please login again.');
  }
}

/**
 * Sets up authentication state and monitoring
 * @param tokens - Authentication tokens to setup
 */
async function setupAuthState(tokens: AuthTokens): Promise<void> {
  // Store tokens securely
  await setAuthTokens(tokens);
  setAuthToken(tokens.accessToken);

  // Setup token refresh monitoring
  setupTokenRefresh(tokens.expiresIn);
}

/**
 * Cleans up authentication state
 */
function cleanupAuthState(): void {
  clearAuthTokens();
  clearAuthToken();
  stopTokenRefresh();
}

/**
 * Sets up automatic token refresh monitoring
 * @param expiresIn - Token expiration time in seconds
 */
function setupTokenRefresh(expiresIn: number): void {
  // Clear any existing refresh interval
  stopTokenRefresh();

  // Calculate refresh timing
  const expiryTime = Date.now() + (expiresIn * 1000);
  const timeUntilRefresh = expiryTime - Date.now() - TOKEN_REFRESH_THRESHOLD;

  // Schedule initial refresh
  if (timeUntilRefresh > 0) {
    setTimeout(() => refreshToken(), timeUntilRefresh);
  }

  // Setup periodic checks
  tokenRefreshInterval = setInterval(() => {
    const timeUntilExpiry = expiryTime - Date.now();
    if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD) {
      refreshToken().catch(() => cleanupAuthState());
    }
  }, TOKEN_CHECK_INTERVAL);
}

/**
 * Stops token refresh monitoring
 */
function stopTokenRefresh(): void {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns boolean indicating if password meets requirements
 */
function isPasswordStrong(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar;
}
