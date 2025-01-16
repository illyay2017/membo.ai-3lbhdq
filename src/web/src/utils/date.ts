// date-fns v2.30.0 - Date manipulation utilities
import { format, formatDistance, parseISO } from 'date-fns';

// Types for function parameters
type DateInput = string | number | Date;
interface Locale {
  code: string;
  formatLong?: {
    date: any;
    time: any;
    dateTime: any;
  };
}

/**
 * Formats a date into a human-readable string with locale and timezone support
 * @param date - Date to format (ISO string, timestamp, or Date object)
 * @param formatString - Format pattern (e.g., 'yyyy-MM-dd')
 * @param locale - Optional locale configuration
 * @returns Formatted date string
 * @throws Error if date or format is invalid
 */
export const formatDate = (
  date: DateInput,
  formatString: string,
  locale?: Locale
): string => {
  try {
    // Convert input to Date object
    const dateObj = typeof date === 'string' 
      ? parseISO(date)
      : typeof date === 'number' 
        ? new Date(date)
        : date;

    // Validate date object
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      throw new Error('Invalid date input');
    }

    // Apply formatting with locale if provided
    return format(dateObj, formatString, {
      locale: locale?.formatLong ? locale : undefined
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    throw new Error(`Failed to format date: ${error.message}`);
  }
};

/**
 * Formats a date relative to current time with smart formatting
 * @param date - Date to format relative to now
 * @param locale - Optional locale configuration
 * @returns Human-readable relative time string
 */
export const formatRelativeTime = (
  date: DateInput,
  locale?: Locale
): string => {
  try {
    const dateObj = typeof date === 'string'
      ? parseISO(date)
      : typeof date === 'number'
        ? new Date(date)
        : date;

    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      throw new Error('Invalid date input');
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    // Smart formatting for recent times
    if (diffInSeconds < 30) {
      return 'just now';
    }

    return formatDistance(dateObj, now, {
      addSuffix: true,
      locale: locale?.formatLong ? locale : undefined
    });
  } catch (error) {
    console.error('Relative time formatting error:', error);
    throw new Error(`Failed to format relative time: ${error.message}`);
  }
};

/**
 * Formats duration in milliseconds to human-readable format
 * @param milliseconds - Duration to format
 * @param includeSeconds - Whether to include seconds in output
 * @returns Formatted duration string
 */
export const formatDuration = (
  milliseconds: number,
  includeSeconds: boolean = false
): string => {
  if (typeof milliseconds !== 'number' || milliseconds < 0) {
    throw new Error('Invalid duration input');
  }

  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  if (includeSeconds && (seconds > 0 || (!hours && !minutes))) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ') || '0m';
};

/**
 * Calculates current study streak with timezone support
 * @param studyDates - Array of study session dates
 * @param timezone - Optional timezone identifier
 * @returns Current streak length in days
 */
export const calculateStreakDays = (
  studyDates: Date[],
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): number => {
  if (!Array.isArray(studyDates) || studyDates.length === 0) {
    return 0;
  }

  // Sort dates in descending order
  const sortedDates = studyDates
    .map(date => new Date(date))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 1;
  let lastDate = new Date(sortedDates[0]);
  
  // Convert to user's timezone
  lastDate = new Date(lastDate.toLocaleString('en-US', { timeZone: timezone }));

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i].toLocaleString('en-US', { timeZone: timezone }));
    const dayDiff = Math.floor(
      (lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff === 1) {
      streak++;
      lastDate = currentDate;
    } else if (dayDiff > 1) {
      break;
    }
  }

  return streak;
};

/**
 * Checks if a date is today in user's timezone
 * @param date - Date to check
 * @param timezone - Optional timezone identifier
 * @returns Boolean indicating if date is today
 */
export const isToday = (
  date: DateInput,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): boolean => {
  try {
    const dateObj = typeof date === 'string'
      ? parseISO(date)
      : typeof date === 'number'
        ? new Date(date)
        : date;

    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      throw new Error('Invalid date input');
    }

    const today = new Date();
    const inputDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }));
    const todayInTz = new Date(today.toLocaleString('en-US', { timeZone: timezone }));

    return (
      inputDate.getFullYear() === todayInTz.getFullYear() &&
      inputDate.getMonth() === todayInTz.getMonth() &&
      inputDate.getDate() === todayInTz.getDate()
    );
  } catch (error) {
    console.error('Date comparison error:', error);
    throw new Error(`Failed to compare date: ${error.message}`);
  }
};