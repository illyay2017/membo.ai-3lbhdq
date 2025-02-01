/**
 * @fileoverview Core API client library for membo.ai web application
 * Implements secure HTTP requests, authentication, error handling, and request/response interceptors
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { API_VERSION, API_BASE_URL, API_HEADERS } from '../constants/api';
import { getAccessToken } from './storage';
import { AuthTokens } from '../types/auth';

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  windowMs: 60000,
  delayAfterExceeding: 1000,
} as const;

/**
 * Retry configuration for failed requests
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffFactor: 2,
  initialDelay: 1000,
} as const;

/**
 * Create base axios instance with default configuration
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL + API_VERSION,
  timeout: 30000,
  headers: {
    [API_HEADERS.CONTENT_TYPE]: 'application/json',
  },
  validateStatus: (status) => status >= 200 && status < 500,
});

/**
 * Rate limit tracking state
 */
let rateLimitState = {
  requestCount: 0,
  windowStart: Date.now(),
  remaining: RATE_LIMIT_CONFIG.maxRequests,
};

/**
 * Sets authentication token and configures interceptors
 * @param token - JWT access token
 */
export function setAuthToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid authentication token');
  }

  axiosInstance.defaults.headers.common[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;

  // Configure request interceptor for token refresh
  axiosInstance.interceptors.request.use(
    async (config) => {
      const tokens = await getAuthTokens();
      if (tokens?.accessToken) {
        config.headers[API_HEADERS.AUTHORIZATION] = `Bearer ${tokens.accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
}

/**
 * Clears authentication token and removes interceptors
 */
export function clearAuthToken(): void {
  delete axiosInstance.defaults.headers.common[API_HEADERS.AUTHORIZATION];
  axiosInstance.interceptors.request.clear();
  rateLimitState = {
    requestCount: 0,
    windowStart: Date.now(),
    remaining: RATE_LIMIT_CONFIG.maxRequests,
  };
}

/**
 * Handles API request errors with retry logic
 * @param error - Error from failed request
 */
async function handleRequestError(error: AxiosError): Promise<never> {
  const standardError = {
    code: error.response?.status?.toString() || 'UNKNOWN',
    message: error.response?.data?.message || error.message,
    originalError: error,
  };

  // Check if request is eligible for retry
  const config = error.config as AxiosRequestConfig & { retryCount?: number };
  if (config && (!config.retryCount || config.retryCount < RETRY_CONFIG.maxRetries)) {
    const retryCount = (config.retryCount || 0) + 1;
    const delay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, retryCount - 1);

    await new Promise(resolve => setTimeout(resolve, delay));
    return axiosInstance({
      ...config,
      retryCount,
    });
  }

  throw standardError;
}

/**
 * Checks and updates rate limit state
 */
function checkRateLimit(): void {
  const now = Date.now();
  if (now - rateLimitState.windowStart >= RATE_LIMIT_CONFIG.windowMs) {
    rateLimitState = {
      requestCount: 0,
      windowStart: now,
      remaining: RATE_LIMIT_CONFIG.maxRequests,
    };
  }

  if (rateLimitState.requestCount >= RATE_LIMIT_CONFIG.maxRequests) {
    throw new Error('Rate limit exceeded');
  }

  rateLimitState.requestCount++;
  rateLimitState.remaining--;
}

/**
 * Makes GET request to API endpoint
 * @param url - API endpoint URL
 * @param config - Axios request configuration
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  checkRateLimit();
  try {
    const response = await axiosInstance.get<T>(url, config);
    return response.data;
  } catch (error) {
    return handleRequestError(error as AxiosError);
  }
}

/**
 * Makes POST request to API endpoint
 * @param url - API endpoint URL
 * @param data - Request payload
 * @param config - Axios request configuration
 */
export async function post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  checkRateLimit();
  try {
    const response = await axiosInstance.post<T>(url, data, config);
    return response.data;
  } catch (error) {
    return handleRequestError(error as AxiosError);
  }
}

/**
 * Makes PUT request to API endpoint
 * @param url - API endpoint URL
 * @param data - Request payload
 * @param config - Axios request configuration
 */
export async function put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  checkRateLimit();
  try {
    const response = await axiosInstance.put<T>(url, data, config);
    return response.data;
  } catch (error) {
    return handleRequestError(error as AxiosError);
  }
}

/**
 * Makes DELETE request to API endpoint
 * @param url - API endpoint URL
 * @param config - Axios request configuration
 */
export async function delete_<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  checkRateLimit();
  try {
    const response = await axiosInstance.delete<T>(url, config);
    return response.data;
  } catch (error) {
    return handleRequestError(error as AxiosError);
  }
}

// Export configured axios instance
export const api = {
  get,
  post,
  put,
  delete: delete_,
  setAuthToken,
  clearAuthToken,
};

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
