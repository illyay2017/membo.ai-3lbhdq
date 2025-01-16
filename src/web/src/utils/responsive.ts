import { useEffect, useState, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import { breakpoints } from '../constants/theme';

/**
 * Type definitions for breakpoint management
 * @version 1.0.0
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';
export type BreakpointValue = number;

/**
 * Constants for responsive behavior configuration
 */
const BREAKPOINT_CHANGE_EVENT = 'breakpointChange' as const;
const DEFAULT_BREAKPOINT: Breakpoint = 'mobile';
const RESIZE_DEBOUNCE_MS = 100;

/**
 * Safely converts breakpoint string values to numeric pixel values
 * @param breakpoint - Target breakpoint to convert
 * @returns Numeric pixel value for the breakpoint
 * @throws Error if breakpoint value is invalid
 */
export const getBreakpointValue = (breakpoint: Breakpoint): BreakpointValue => {
  const value = breakpoints.values[breakpoint];
  if (!value) {
    throw new Error(`Invalid breakpoint: ${breakpoint}`);
  }
  
  const numericValue = parseInt(value, 10);
  if (isNaN(numericValue)) {
    throw new Error(`Invalid breakpoint value: ${value}`);
  }
  
  return numericValue;
};

/**
 * SSR-safe utility to check if current viewport matches a breakpoint
 * @param breakpoint - Target breakpoint to check
 * @returns Boolean indicating if viewport matches the breakpoint
 */
export const isBreakpoint = (breakpoint: Breakpoint): boolean => {
  // Handle SSR case
  if (typeof window === 'undefined') {
    return breakpoint === DEFAULT_BREAKPOINT;
  }

  const breakpointValue = getBreakpointValue(breakpoint);
  const windowWidth = window.innerWidth;

  // Handle different breakpoint ranges
  switch (breakpoint) {
    case 'mobile':
      return windowWidth >= getBreakpointValue('mobile') && 
             windowWidth < getBreakpointValue('tablet');
    case 'tablet':
      return windowWidth >= getBreakpointValue('tablet') && 
             windowWidth < getBreakpointValue('desktop');
    case 'desktop':
      return windowWidth >= getBreakpointValue('desktop') && 
             windowWidth < getBreakpointValue('wide');
    case 'wide':
      return windowWidth >= getBreakpointValue('wide');
    default:
      return false;
  }
};

/**
 * React hook providing reactive breakpoint detection with efficient resize handling
 * @returns Current active breakpoint
 */
export const useBreakpoint = (): Breakpoint => {
  // Initialize with SSR-safe default
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(DEFAULT_BREAKPOINT);

  /**
   * Memoized function to determine current breakpoint
   */
  const calculateBreakpoint = useCallback((): Breakpoint => {
    if (typeof window === 'undefined') return DEFAULT_BREAKPOINT;

    if (isBreakpoint('wide')) return 'wide';
    if (isBreakpoint('desktop')) return 'desktop';
    if (isBreakpoint('tablet')) return 'tablet';
    return 'mobile';
  }, []);

  /**
   * Debounced resize handler to prevent excessive updates
   */
  const handleResize = useMemo(
    () =>
      debounce(() => {
        const newBreakpoint = calculateBreakpoint();
        if (newBreakpoint !== currentBreakpoint) {
          setCurrentBreakpoint(newBreakpoint);
          // Dispatch custom event for external listeners
          window.dispatchEvent(
            new CustomEvent(BREAKPOINT_CHANGE_EVENT, {
              detail: { breakpoint: newBreakpoint }
            })
          );
        }
      }, RESIZE_DEBOUNCE_MS),
    [calculateBreakpoint, currentBreakpoint]
  );

  useEffect(() => {
    // Set initial breakpoint
    setCurrentBreakpoint(calculateBreakpoint());

    // Add resize listener with cleanup
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      handleResize.cancel();
    };
  }, [handleResize, calculateBreakpoint]);

  return currentBreakpoint;
};