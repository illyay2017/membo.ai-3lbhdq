/**
 * API Configuration Constants
 * Centralized configuration for all API-related constants used in the membo.ai web application.
 * @version 1.0.0
 */

/**
 * Current API version prefix for all endpoints
 * Used to support versioning and backward compatibility
 */
export const API_VERSION = '/api/v1';

/**
 * Base URL for API requests
 * Falls back to localhost in development environment
 */
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Comprehensive collection of API endpoints organized by feature domain
 * All paths are relative to API_BASE_URL + API_VERSION
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    CHANGE_PASSWORD: '/auth/change-password',
  },

  CONTENT: {
    BASE: '/content',
    CAPTURE: '/content/capture',
    PROCESS: '/content/process',
    ARCHIVE: '/content/archive',
    BATCH: '/content/batch',
    SEARCH: '/content/search',
    TAGS: '/content/tags',
  },

  CARDS: {
    BASE: '/cards',
    GENERATE: '/cards/generate',
    FSRS: '/cards/:id/fsrs',
    BATCH: '/cards/batch',
    IMPORT: '/cards/import',
    EXPORT: '/cards/export',
    TEMPLATES: '/cards/templates',
  },

  STUDY: {
    BASE: '/study',
    SESSION: '/study/session',
    PROGRESS: '/study/progress',
    QUIZ: '/study/quiz',
    STATS: '/study/stats',
    HISTORY: '/study/history',
    STREAK: '/study/streak',
  },

  AI: {
    GENERATE_CARDS: '/ai/generate-cards',
    GENERATE_QUIZ: '/ai/generate-quiz',
    ANALYZE_CONTENT: '/ai/analyze-content',
    OPTIMIZE_CARDS: '/ai/optimize-cards',
    SUGGEST_TAGS: '/ai/suggest-tags',
  },

  VOICE: {
    PROCESS: '/voice/process',
    VALIDATE: '/voice/validate',
    FEEDBACK: '/voice/feedback',
    CALIBRATE: '/voice/calibrate',
    SETTINGS: '/voice/settings',
  },
} as const;

/**
 * Standard HTTP headers for API requests
 * Includes security and performance-related headers
 */
export const API_HEADERS = {
  CONTENT_TYPE: 'application/json',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'application/json',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  CACHE_CONTROL: 'Cache-Control',
  CORRELATION_ID: 'X-Correlation-ID',
} as const;

/**
 * Helper function to build full API URL
 * @param endpoint - The API endpoint path
 * @returns The complete API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${API_VERSION}${endpoint}`;
};

/**
 * Helper function to build authorization header with token
 * @param token - JWT access token
 * @returns Authorization header object
 */
export const buildAuthHeader = (token: string) => ({
  [API_HEADERS.AUTHORIZATION]: `Bearer ${token}`,
});

/**
 * Default request headers for API calls
 */
export const DEFAULT_HEADERS = {
  [API_HEADERS.CONTENT_TYPE]: API_HEADERS.CONTENT_TYPE,
  [API_HEADERS.ACCEPT]: API_HEADERS.ACCEPT,
} as const;