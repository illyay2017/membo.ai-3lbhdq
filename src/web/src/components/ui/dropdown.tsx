import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { ChevronDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "class-variance-authority"
import Button, { buttonVariants } from "./button"
import { colors, typography, spacing } from "../../constants/theme"

// Constants for dropdown styling variants
export const DROPDOWN_VARIANTS = {
  primary: `bg-[${colors.primary}] text-white hover:bg-[${colors.primary}]/90 focus:ring-2 focus:ring-[${colors.primary}]/50 dark:bg-[${colors.primary}]/80`,
  secondary: `bg-[${colors.secondary}] text-white hover:bg-[${colors.secondary}]/90 focus:ring-2 focus:ring-[${colors.secondary}]/50 dark:bg-[${colors.secondary}]/80`,
  outline: `border-2 border-[${colors.primary}] text-[${colors.primary}] hover:bg-[${colors.primary}]/10 focus:ring-2 focus:ring-[${colors.primary}]/50 dark:border-[${colors.primary}]/80`
} as const

// Constants for dropdown sizes
export const DROPDOWN_SIZES = {
  sm: `min-w-[120px] text-[${typography.fontSize.sm}] py-[${spacing.scale[1]}] px-[${spacing.scale[2]}]`,
  md: `min-w-[160px] text-[${typography.fontSize.base}] py-[${spacing.scale[2]}] px-[${spacing.scale[3]}]`,
  lg: `min-w-[200px] text-[${typography.fontSize.lg}] py-[${spacing.scale[3]}] px-[${spacing.scale[4]}]`
} as const

// Animation constants
const DROPDOWN_ANIMATIONS = {
  enter: "transition-all duration-200 ease-out",
  leave: "transition-all duration-150 ease-in",
  scale: "transform-gpu scale-95 opacity-0",
  visible: "transform-gpu scale-100 opacity-100"
} as const

// Types
export interface DropdownOption {
  value: string
  label: string
  disabled?: boolean
}

export interface DropdownProps {
  options: DropdownOption[]
  value?: string | string[]
  onChange: (value: string | string[]) => void
  variant?: keyof typeof DROPDOWN_VARIANTS
  size?: keyof typeof DROPDOWN_SIZES
  multiple?: boolean
  searchable?: boolean
  disabled?: boolean
  virtualScroll?: boolean
  placeholder?: string
  className?: string
}

// Utility function for generating dropdown variant classes
export const dropdownVariants = React.memo(({
  variant = "primary",
  size = "md",
  disabled,
  className
}: {
  variant: keyof typeof DROPDOWN_VARIANTS
  size: keyof typeof DROPDOWN_SIZES
  disabled?: boolean
  className?: string
}) => {
  return cn(
    "rounded-md font-medium transition-colors focus:outline-none",
    DROPDOWN_VARIANTS[variant],
    DROPDOWN_SIZES[size],
    disabled && "opacity-50 cursor-not-allowed",
    className
  )
})

// Custom hook for search functionality
const useDropdownSearch = (options: DropdownOption[]) => {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filteredOptions, setFilteredOptions] = React.useState(options)
  const [isSearching, setIsSearching] = React.useState(false)

  const handleSearch = React.useCallback((term: string) => {
    setSearchTerm(term)
    setIsSearching(true)

    const filtered = options.filter(option =>
      option.label.toLowerCase().includes(term.toLowerCase())
    )
    setFilteredOptions(filtered)
    setIsSearching(false)
  }, [options])

  return { filteredOptions, handleSearch, isSearching }
}

// Main Dropdown component
const Dropdown = React.memo(React.forwardRef<HTMLDivElement, DropdownProps>(
  ({
    options,
    value,
    onChange,
    variant = "primary",
    size = "md",
    multiple = false,
    searchable = false,
    disabled = false,
    virtualScroll = false,
    placeholder = "Select option",
    className
  }, ref) => {
    const [open, setOpen] = React.useState(false)
    const { filteredOptions, handleSearch, isSearching } = useDropdownSearch(options)
    
    // Virtual scroll setup
    const parentRef = React.useRef<HTMLDivElement>(null)
    const rowVirtualizer = useVirtualizer({
      count: filteredOptions.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 40,
      overscan: 5
    })

    // Handle selection
    const handleSelect = React.useCallback((optionValue: string) => {
      if (multiple) {
        const currentValues = Array.isArray(value) ? value : []
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter(v => v !== optionValue)
          : [...currentValues, optionValue]
        onChange(newValues)
      } else {
        onChange(optionValue)
        setOpen(false)
      }
    }, [multiple, value, onChange])

    // Get selected label(s)
    const getSelectedLabel = () => {
      if (multiple && Array.isArray(value)) {
        return value.length
          ? `${value.length} selected`
          : placeholder
      }
      const selected = options.find(opt => opt.value === value)
      return selected ? selected.label : placeholder
    }

    return (
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger
          asChild
          disabled={disabled}
        >
          <Button
            variant={variant}
            size={size}
            className={cn(
              "w-full justify-between",
              className
            )}
          >
            <span className="truncate">{getSelectedLabel()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            ref={ref}
            className={cn(
              "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              DROPDOWN_ANIMATIONS.enter,
              DROPDOWN_ANIMATIONS.leave,
              open ? DROPDOWN_ANIMATIONS.visible : DROPDOWN_ANIMATIONS.scale
            )}
            align="start"
            sideOffset={4}
          >
            {searchable && (
              <div className="px-2 py-1.5">
                <input
                  type="text"
                  className="w-full rounded-sm border px-2 py-1 text-sm"
                  placeholder="Search..."
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            )}

            <div
              ref={parentRef}
              className={cn(
                "overflow-auto",
                virtualScroll && "max-h-[300px]"
              )}
            >
              {virtualScroll ? (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative"
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const option = filteredOptions[virtualRow.index]
                    return (
                      <DropdownMenuPrimitive.Item
                        key={option.value}
                        className={cn(
                          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                          "focus:bg-slate-100 focus:text-slate-900",
                          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                          multiple && "data-[state=checked]:bg-slate-100"
                        )}
                        disabled={option.disabled}
                        onSelect={() => handleSelect(option.value)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`
                        }}
                      >
                        {option.label}
                      </DropdownMenuPrimitive.Item>
                    )
                  })}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <DropdownMenuPrimitive.Item
                    key={option.value}
                    className={cn(
                      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                      "focus:bg-slate-100 focus:text-slate-900",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      multiple && "data-[state=checked]:bg-slate-100"
                    )}
                    disabled={option.disabled}
                    onSelect={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </DropdownMenuPrimitive.Item>
                ))
              )}
            </div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    )
  }
))

Dropdown.displayName = "Dropdown"

export default Dropdown