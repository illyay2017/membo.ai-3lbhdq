/**
 * @fileoverview Confidence level buttons component for study sessions
 * Implements FSRS algorithm rating system with voice mode support
 * @version 1.0.0
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "../ui/button";
import { useStudySession } from "../../hooks/useStudySession";

/**
 * Props interface for the ConfidenceButtons component
 */
interface ConfidenceButtonsProps {
  /** Disables all buttons during voice mode or processing */
  disabled?: boolean;
  /** Controls visibility of confidence level labels */
  showLabels?: boolean;
  /** Button size variants */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Optional callback for confidence submission */
  onConfidenceSubmit?: (level: number) => Promise<void>;
}

/**
 * Confidence level definitions based on FSRS algorithm
 * Each level maps to specific learning outcomes and retention metrics
 */
const CONFIDENCE_LEVELS = [
  {
    value: 1,
    label: 'Again',
    variant: 'outline',
    description: 'Complete blackout, wrong response',
    ariaLabel: 'Rate as complete blackout or wrong response',
    analyticsId: 'confidence_again'
  },
  {
    value: 2,
    label: 'Hard',
    variant: 'secondary',
    description: 'Correct with much difficulty',
    ariaLabel: 'Rate as correct with significant difficulty',
    analyticsId: 'confidence_hard'
  },
  {
    value: 3,
    label: 'Good',
    variant: 'primary',
    description: 'Correct with some difficulty',
    ariaLabel: 'Rate as correct with some difficulty',
    analyticsId: 'confidence_good'
  },
  {
    value: 4,
    label: 'Easy',
    variant: 'accent',
    description: 'Perfect response',
    ariaLabel: 'Rate as perfect response',
    analyticsId: 'confidence_easy'
  }
] as const;

/**
 * ConfidenceButtons component for rating study card responses
 * Implements FSRS algorithm confidence levels with accessibility support
 */
const ConfidenceButtons: React.FC<ConfidenceButtonsProps> = ({
  disabled = false,
  showLabels = true,
  size = 'md',
  className,
  onConfidenceSubmit
}) => {
  // Get study session context
  const { submitReview, isLoading } = useStudySession();

  // Track loading state for individual buttons
  const [loadingStates, setLoadingStates] = React.useState<Record<number, boolean>>({});

  /**
   * Handles confidence button click with loading state and analytics
   */
  const handleConfidenceClick = React.useCallback(async (
    confidenceLevel: number,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();

    if (isLoading || loadingStates[confidenceLevel]) {
      return;
    }

    try {
      // Set loading state for clicked button
      setLoadingStates(prev => ({ ...prev, [confidenceLevel]: true }));

      // Submit confidence level
      if (onConfidenceSubmit) {
        await onConfidenceSubmit(confidenceLevel);
      } else {
        await submitReview(confidenceLevel);
      }

    } catch (error) {
      console.error('Failed to submit confidence level:', error);
    } finally {
      // Reset loading state
      setLoadingStates(prev => ({ ...prev, [confidenceLevel]: false }));
    }
  }, [isLoading, loadingStates, onConfidenceSubmit, submitReview]);

  return (
    <div 
      className={cn(
        "flex flex-wrap gap-2 justify-center items-center",
        className
      )}
      role="group"
      aria-label="Rate your confidence level"
    >
      {CONFIDENCE_LEVELS.map(level => (
        <Button
          key={level.value}
          variant={level.variant as any}
          size={size}
          disabled={disabled || isLoading}
          loading={loadingStates[level.value]}
          onClick={(e) => handleConfidenceClick(level.value, e)}
          className={cn(
            buttonVariants({ variant: level.variant as any, size }),
            "min-w-[100px] relative group"
          )}
          aria-label={level.ariaLabel}
          data-analytics-id={level.analyticsId}
        >
          {showLabels && (
            <span className="flex flex-col items-center gap-1">
              <span className="font-medium">{level.label}</span>
              <span className="text-xs opacity-75 hidden group-hover:block absolute -bottom-6 whitespace-nowrap">
                {level.description}
              </span>
            </span>
          )}
          {!showLabels && level.label}
        </Button>
      ))}
    </div>
  );
};

// Display name for React DevTools
ConfidenceButtons.displayName = "ConfidenceButtons";

export default ConfidenceButtons;