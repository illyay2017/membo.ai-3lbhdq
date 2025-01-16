/**
 * Core theme constants and design tokens for membo.ai web application
 * Implements design system specifications with support for dark mode and accessibility
 * @version 1.0.0
 */

/**
 * Core color palette including semantic colors and dark mode variants
 */
export const colors = {
  // Primary brand colors
  primary: '#2563eb',
  secondary: '#64748b',
  accent: '#0ea5e9',
  error: '#ef4444',

  // Background colors with dark mode support
  background: {
    light: '#ffffff',
    dark: '#1a1a1a'
  },

  // Semantic colors for status and feedback
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
} as const;

/**
 * Typography system including font families, sizes, weights and line heights
 */
export const typography = {
  // Font families for different purposes
  fontFamily: {
    primary: 'Inter',
    secondary: 'SF Pro',
    code: 'JetBrains Mono'
  },

  // Font size scale with rem units for accessibility
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem'     // 48px
  },

  // Font weights for different text styles
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },

  // Line height scale for optimal readability
  lineHeight: {
    none: '1',
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75'
  }
} as const;

/**
 * Spacing system based on 4px grid with container constraints
 */
export const spacing = {
  // Base spacing scale
  scale: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
    12: '48px',
    16: '64px'
  },

  // Container width constraints
  container: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px'
  }
} as const;

/**
 * Responsive breakpoints and utility functions
 */
export const breakpoints = {
  // Breakpoint values
  values: {
    mobile: '320px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px'
  },

  // Media query helper function
  up: (breakpoint: keyof typeof breakpoints.values) => {
    return `@media (min-width: ${breakpoints.values[breakpoint]})`;
  }
} as const;

/**
 * Type definitions for theme values
 */
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Breakpoints = typeof breakpoints;

/**
 * CSS variables for runtime theme switching
 * Used by shadcn/ui components and custom theming
 */
export const cssVariables = {
  light: {
    '--background': colors.background.light,
    '--foreground': colors.secondary,
    '--primary': colors.primary,
    '--primary-foreground': '#ffffff',
    '--secondary': colors.secondary,
    '--secondary-foreground': '#ffffff',
    '--accent': colors.accent,
    '--accent-foreground': '#ffffff',
    '--error': colors.error,
    '--error-foreground': '#ffffff',
    '--success': colors.semantic.success,
    '--warning': colors.semantic.warning,
    '--info': colors.semantic.info
  },
  dark: {
    '--background': colors.background.dark,
    '--foreground': '#ffffff',
    '--primary': colors.primary,
    '--primary-foreground': '#ffffff',
    '--secondary': colors.secondary,
    '--secondary-foreground': '#ffffff',
    '--accent': colors.accent,
    '--accent-foreground': '#ffffff',
    '--error': colors.error,
    '--error-foreground': '#ffffff',
    '--success': colors.semantic.success,
    '--warning': colors.semantic.warning,
    '--info': colors.semantic.info
  }
} as const;