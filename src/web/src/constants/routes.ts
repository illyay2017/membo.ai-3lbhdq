/**
 * @fileoverview Centralized route configuration constants for the membo.ai web application.
 * Defines all application routes and their paths for consistent navigation and routing management.
 * @version 1.0.0
 */

/**
 * Authentication related routes
 */
export const AUTH = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password/:token',
  VERIFY_EMAIL: '/auth/verify-email/:token',
} as const;

/**
 * Content management routes
 */
export const CONTENT = {
  INBOX: '/content/inbox',
  ARCHIVE: '/content/archive',
  CAPTURE: '/content/capture',
  VIEW: '/content/:id',
  EDIT: '/content/:id/edit',
  TAGS: '/content/tags',
} as const;

/**
 * Flashcard management routes
 */
export const CARDS = {
  LIST: '/cards',
  CREATE: '/cards/create',
  EDIT: '/cards/:id',
  VIEW: '/cards/:id/view',
  BATCH: '/cards/batch',
  IMPORT: '/cards/import',
  EXPORT: '/cards/export',
} as const;

/**
 * Study and review routes
 */
export const STUDY = {
  HOME: '/study',
  VOICE_MODE: '/study/voice',
  QUIZ_MODE: '/study/quiz',
  REVIEW: '/study/review',
  STATS: '/study/statistics',
  SESSION: '/study/session/:id',
} as const;

/**
 * User settings and configuration routes
 */
export const SETTINGS = {
  HOME: '/settings',
  PROFILE: '/settings/profile',
  PREFERENCES: '/settings/preferences',
  NOTIFICATIONS: '/settings/notifications',
  BILLING: '/settings/billing',
  INTEGRATIONS: '/settings/integrations',
  SECURITY: '/settings/security',
} as const;

/**
 * Dashboard and analytics routes
 */
export const DASHBOARD = {
  HOME: '/dashboard',
  ANALYTICS: '/dashboard/analytics',
  PROGRESS: '/dashboard/progress',
  ACHIEVEMENTS: '/dashboard/achievements',
} as const;

/**
 * Help and support routes
 */
export const HELP = {
  HOME: '/help',
  DOCS: '/help/documentation',
  FAQ: '/help/faq',
  SUPPORT: '/help/support',
  CONTACT: '/help/contact',
} as const;

/**
 * Main routes configuration object containing all application routes
 */
export const ROUTES = {
  AUTH,
  CONTENT,
  CARDS,
  STUDY,
  SETTINGS,
  DASHBOARD,
  HELP,
} as const;

/**
 * Default export of all routes for convenient importing
 */
export default ROUTES;