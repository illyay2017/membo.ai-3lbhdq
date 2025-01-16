import * as React from 'react'
import { Slot } from '@radix-ui/react-slot' // v1.0.0
import { cva, type VariantProps } from 'class-variance-authority' // v0.7.0
import { colors } from '../../constants/theme'

// Card variant styles using class-variance-authority
export const cardVariants = cva(
  'rounded-lg border p-4 shadow-sm transition-colors',
  {
    variants: {
      variant: {
        default: [
          'bg-background-light dark:bg-background-dark',
          'shadow-sm'
        ],
        interactive: [
          'bg-background-light dark:bg-background-dark',
          'shadow-sm hover:shadow-md',
          'focus:ring-2 focus:ring-primary',
          'transition-all cursor-pointer'
        ],
        elevated: [
          'bg-background-light dark:bg-background-dark',
          'shadow-md'
        ]
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

// Extract variant props type from cardVariants
type CardVariantProps = VariantProps<typeof cardVariants>

// Props interface for Card component
interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    CardVariantProps {
  asChild?: boolean
}

/**
 * A reusable card component that implements the membo.ai design system specifications.
 * Provides a container for content with consistent styling, elevation, and interactive states.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant = 'default', asChild = false, ...props },
    ref
  ) => {
    // Determine the component to render based on asChild prop
    const Comp = asChild ? Slot : 'div'

    // Add appropriate ARIA role for interactive variant
    const interactiveProps = variant === 'interactive' 
      ? { role: 'button', tabIndex: 0 }
      : {}

    return (
      <Comp
        ref={ref}
        className={cardVariants({ variant, className })}
        {...interactiveProps}
        {...props}
      />
    )
  }
)

// Display name for dev tools and debugging
Card.displayName = 'Card'

export default Card