/**
 * @fileoverview Authentication service for membo.ai web application
 * Implements secure JWT-based authentication with Supabase, including token management,
 * role-based access control, and proactive token refresh mechanisms.
 * @version 1.0.0
 */

import { post, setAuthToken, clearAuthToken } from '../lib/api';
import { setAuthTokens, clearAuthTokens } from '../lib/storage';
import { LoginCredentials, RegisterCredentials, AuthResponse, AuthTokens } from '../types/auth';
import { API_ENDPOINTS } from '../constants/api';

// Token refresh configuration
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes before expiry
const TOKEN_CHECK_INTERVAL = 60000; // Check every minute

let tokenRefreshInterval: NodeJS.Timeout | null = null;

/**
 * Authenticates user with provided credentials
 * @param credentials - User login credentials
 * @returns Authentication response with user data and tokens
 * @throws Error if authentication fails
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // Validate input credentials
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials provided');
    }

    // Attempt authentication
    const response = await post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );

    // Validate response
    if (!response?.tokens?.accessToken || !response?.user) {
      throw new Error('Invalid authentication response');
    }

    // Setup authentication state
    await setupAuthState(response.tokens);

    return response;
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
    const response = await post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      userData
    );

    // Validate response
    if (!response?.tokens?.accessToken || !response?.user) {
      throw new Error('Invalid registration response');
    }

    // Setup authentication state
    await setupAuthState(response.tokens);

    return response;
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
    await post(API_ENDPOINTS.AUTH.LOGOUT);
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
    const response = await post<AuthResponse>(API_ENDPOINTS.AUTH.REFRESH);

    // Validate refresh response
    if (!response?.tokens?.accessToken) {
      throw new Error('Invalid token refresh response');
    }

    // Update auth state with new tokens
    await setupAuthState(response.tokens);

    return response;
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