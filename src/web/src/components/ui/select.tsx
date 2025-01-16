import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "class-variance-authority"
import { colors } from "../../constants/theme"

// Constants for select styling variants
const SELECT_VARIANTS = {
  primary: `bg-[${colors.primary}] text-white hover:bg-primary-dark focus:ring-2 focus:ring-primary-light dark:bg-primary-dark dark:hover:bg-primary`,
  secondary: `bg-[${colors.secondary}] text-white hover:bg-secondary-dark focus:ring-2 focus:ring-secondary-light dark:bg-secondary-dark dark:hover:bg-secondary`,
  outline: `border-2 border-[${colors.primary}] text-[${colors.primary}] hover:bg-primary-light focus:ring-2 focus:ring-primary dark:border-primary-light dark:text-primary-light`
}

const SELECT_SIZES = {
  sm: "min-w-[120px] text-sm py-1 px-2",
  md: "min-w-[160px] text-base py-2 px-3",
  lg: "min-w-[200px] text-lg py-3 px-4"
}

const SELECT_ANIMATIONS = {
  enter: "transition-all duration-200 ease-out transform-gpu",
  leave: "transition-all duration-150 ease-in transform-gpu",
  content: "data-[state=open]:animate-in data-[state=closed]:animate-out",
  scroll: "transition-transform duration-200"
}

// Type definitions
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  variant?: keyof typeof SELECT_VARIANTS
  size?: keyof typeof SELECT_SIZES
  options: SelectOption[]
  placeholder?: string
  error?: string
  required?: boolean
  className?: string
}

// Utility function for generating select variant classes
export const selectVariants = React.memo(({ 
  variant = "primary",
  size = "md",
  disabled,
  className 
}: {
  variant?: keyof typeof SELECT_VARIANTS
  size?: keyof typeof SELECT_SIZES
  disabled?: boolean
  className?: string
}) => {
  return cn(
    // Base styles
    "rounded-md outline-none transition-colors focus:outline-none",
    // Variant styles
    SELECT_VARIANTS[variant],
    // Size styles
    SELECT_SIZES[size],
    // Disabled state
    disabled && "opacity-50 cursor-not-allowed",
    // Custom className
    className
  )
})

// Select component implementation
export const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  SelectProps
>(({
  variant = "primary",
  size = "md",
  options,
  placeholder,
  error,
  required,
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <SelectPrimitive.Root {...props} ref={ref}>
      <SelectPrimitive.Trigger
        className={selectVariants({
          variant,
          size,
          disabled,
          className
        })}
        aria-invalid={!!error}
        aria-required={required}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ml-2">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md dark:bg-gray-800",
            SELECT_ANIMATIONS.content,
            SELECT_ANIMATIONS.enter
          )}
        >
          <SelectPrimitive.ScrollUpButton className={cn(
            "flex items-center justify-center h-[25px] bg-white dark:bg-gray-800 cursor-default",
            SELECT_ANIMATIONS.scroll
          )}>
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex items-center px-8 py-2 rounded-sm text-sm outline-none",
                  "data-[highlighted]:bg-primary-light data-[highlighted]:text-primary",
                  "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
                  "dark:data-[highlighted]:bg-primary-dark dark:data-[highlighted]:text-white"
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className={cn(
            "flex items-center justify-center h-[25px] bg-white dark:bg-gray-800 cursor-default",
            SELECT_ANIMATIONS.scroll
          )}>
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>

      {error && (
        <p className={`mt-1 text-sm text-[${colors.error}]`} role="alert">
          {error}
        </p>
      )}
    </SelectPrimitive.Root>
  )
})

Select.displayName = "Select"

export default Select