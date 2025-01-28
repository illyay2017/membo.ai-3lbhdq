import * as React from "react"
import { Slot } from "@radix-ui/react-slot" // v1.0.0
import { cva, type VariantProps } from "class-variance-authority" // v0.7.0
// import { cn } from "@/lib/utils"  // Use local cn utility
import { colors } from "../../constants/theme"
import { cn } from "@/lib/utils"

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
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Button component props interface
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

// Main Button component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={props.disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </div>
        ) : (
          props.children
        )}
      </Comp>
    );
  }
);

// Display name for React DevTools
Button.displayName = "Button"

export { Button, buttonVariants }  // Add buttonVariants to exports
export default Button
