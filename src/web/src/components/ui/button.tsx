import * as React from "react"
import { Slot } from "@radix-ui/react-slot" // v1.0.0
import { cva, type VariantProps } from "class-variance-authority" // v0.7.0
// import { cn } from "@/lib/utils"  // Use local cn utility
import { colors } from "../../constants/theme"

// Button variant and size constants based on design system
const BUTTON_VARIANTS = {
  primary: `bg-[${colors.primary}] text-white hover:bg-[${colors.primary}]/90 focus:ring-2 focus:ring-[${colors.primary}]/50`,
  secondary: `bg-[${colors.secondary}] text-white hover:bg-[${colors.secondary}]/90 focus:ring-2 focus:ring-[${colors.secondary}]/50`,
  outline: `border-2 border-[${colors.primary}] text-[${colors.primary}] hover:bg-[${colors.primary}]/10 focus:ring-2 focus:ring-[${colors.primary}]/50`,
  ghost: `text-[${colors.primary}] hover:bg-[${colors.primary}]/10 focus:ring-2 focus:ring-[${colors.primary}]/50`
} as const

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg"
} as const

// Button variant props type definition
interface ButtonVariantProps {
  variant?: keyof typeof BUTTON_VARIANTS
  size?: keyof typeof BUTTON_SIZES
  className?: string
}

// Generate button classes based on variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: `bg-[${colors.primary}] text-white hover:bg-[${colors.primary}]/90`,
        secondary: `bg-[${colors.secondary}] text-white hover:bg-[${colors.secondary}]/90`,
        outline: `border-2 border-[${colors.primary}] text-[${colors.primary}] hover:bg-[${colors.primary}]/10 focus:ring-2 focus:ring-[${colors.primary}]/50`,
        ghost: `text-[${colors.primary}] hover:bg-[${colors.primary}]/10 focus:ring-2 focus:ring-[${colors.primary}]/50`
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
)

// Button component props interface
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  asChild?: boolean
  loading?: boolean
}

// Main Button component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Use Slot if asChild is true, otherwise use button element
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={buttonVariants({
          variant,
          size,
          className,
        })}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </div>
        ) : (
          children
        )}
      </Comp>
    )
  }
)

// Display name for React DevTools
Button.displayName = "Button"

export { Button, buttonVariants }  // Add buttonVariants to exports
export default Button
