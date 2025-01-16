import React from 'react';
import { cn } from 'class-variance-authority';
import { colors } from '../../constants/theme';

// Progress bar variant types
type ProgressVariant = 'default' | 'accent' | 'success' | 'warning';

// Component props interface
interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
  showPercentage?: boolean;
  variant?: ProgressVariant;
  ariaLabel?: string;
}

// Progress bar variants mapping
const PROGRESS_VARIANTS = {
  default: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-green-500',
  warning: 'bg-yellow-500'
} as const;

// Animation duration constant
const ANIMATION_DURATION = '300ms';

/**
 * Calculates the progress bar width percentage with boundary protection
 * @param current - Current progress value
 * @param total - Total progress value
 * @returns Formatted percentage string
 */
const calculateProgressWidth = (current: number, total: number): string => {
  if (total <= 0 || current < 0) return '0%';
  const percentage = Math.min(Math.max((current / total) * 100, 0), 100);
  return `${percentage.toFixed(2)}%`;
};

/**
 * ProgressBar Component
 * Displays study session progress with animation and accessibility support
 */
const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  current,
  total,
  className,
  showPercentage = false,
  variant = 'default',
  ariaLabel = 'Study progress'
}) => {
  // Calculate progress width
  const progressWidth = calculateProgressWidth(current, total);
  
  // Generate variant-specific styles
  const progressBarStyles = cn(
    'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
    className
  );

  const progressFillStyles = cn(
    'h-full transition-all duration-300 ease-in-out rounded-full',
    PROGRESS_VARIANTS[variant]
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round((current / total) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={progressBarStyles}
    >
      <div
        className={progressFillStyles}
        style={{
          width: progressWidth,
          transition: `width ${ANIMATION_DURATION} ease-in-out`
        }}
      >
        {showPercentage && (
          <span className="sr-only">
            {`${Math.round((current / total) * 100)}% complete`}
          </span>
        )}
      </div>
      
      {showPercentage && (
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {progressWidth}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
ProgressBar.displayName = 'ProgressBar';

// Default export
export default ProgressBar;

// Type export for consumers
export type { ProgressBarProps, ProgressVariant };