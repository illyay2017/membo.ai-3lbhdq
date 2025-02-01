/**
 * @fileoverview Authentication service for membo.ai web application
 * Implements secure JWT-based authentication with Supabase, including token management,
 * role-based access control, and proactive token refresh mechanisms.
 * @version 1.0.0
 */

import { getAccessToken, setAuthTokens, clearAuthTokens } from '../lib/storage';
import { LoginCredentials, RegisterCredentials, AuthResponse, AuthTokens } from '../types/auth';
import { API_ENDPOINTS } from '../constants/api';
import { setAuthToken } from '@/lib/api';

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
  console.log('Attempting login with:', { ...credentials, password: '[REDACTED]' });
  
  const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(credentials),
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    console.error('Login failed:', errorData || response.statusText);
    throw new Error(errorData?.detail || 'Authentication failed');
  }

  const data = await response.json();
  
  console.log('Login response:', {
    hasUser: !!data.data?.user,
    hasToken: !!data.data?.token,
    hasRefreshToken: !!data.data?.refreshToken,
    responseShape: Object.keys(data.data || {})
  });
  
  // Transform response to match backend shape
  const authResponse: AuthResponse = {
    user: data.data.user,
    tokens: {
      accessToken: data.data.token,
      refreshToken: data.data.refreshToken,
      expiresIn: 3600
    }
  };

  // Store tokens securely
  localStorage.setItem('refreshToken', authResponse.tokens.refreshToken);
  await setupAuthState(authResponse.tokens);

  return authResponse;
}

/**
 * Registers new user account with provided data
 * @param userData - User registration data
 * @returns Authentication response for new account
 * @throws Error if registration fails
 */
export async function register(userData: RegisterCredentials): Promise<AuthResponse> {
  try {
    console.log('Starting registration process...');
    
    const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData),
      credentials: 'include'
    });

    console.log('Raw response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    const data = await response.json();
    console.log('Response data:', {
      ...data,
      user: data.user ? 'Present' : 'Missing',
      token: data.token ? 'Present' : 'Missing',
      tokens: data.tokens ? 'Present' : 'Missing'
    });

    if (!response.ok) {
      console.error('Registration error:', data);
      throw new Error(data.detail || data.message || 'Registration failed');
    }

    // Ensure we have the required data
    if (!data.user || (!data.token && !data.tokens?.accessToken)) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid registration response format');
    }

    const authResponse: AuthResponse = {
      user: data.user,
      tokens: {
        accessToken: data.token || data.tokens?.accessToken,
        refreshToken: data.refreshToken || data.tokens?.refreshToken,
        expiresIn: data.expiresIn || data.tokens?.expiresIn || 3600
      }
    };

    console.log('Processed auth response:', {
      hasUser: !!authResponse.user,
      hasTokens: !!authResponse.tokens
    });

    // Setup authentication state
    await setupAuthState(authResponse.tokens);

    return authResponse;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

/**
 * Logs out current user and cleans up auth state
 * @throws Error if logout fails
 */
export async function logout(): Promise<void> {
  try {
    const accessToken = getAccessToken();
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Send logout request to backend
    const response = await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || ''}`
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Logout failed:', errorData || response.statusText);
      throw new Error(errorData?.message || 'Logout failed');
    }
  } finally {
    clearAuthTokens();
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
