import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export function buttonVariants({ variant = 'default', size = 'md', className = '' }: {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
} = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    {
      'bg-primary text-white hover:bg-primary/90': variant === 'default',
      'border border-input bg-background hover:bg-accent': variant === 'outline',
      'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
    },
    {
      'h-9 px-4 text-sm': size === 'sm',
      'h-10 px-4 py-2': size === 'md',
      'h-11 px-8': size === 'lg',
    },
    className
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, loading, variant = 'default', size = 'md', children, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // Wrap children and loading indicator in a fragment or span
    const content = (
      <>
        {loading && (
          <span className="mr-2 inline-block">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </span>
        )}
        {children}
      </>
    );

    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-primary text-white hover:bg-primary/90': variant === 'default',
            'border border-input bg-background hover:bg-accent': variant === 'outline',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
          },
          {
            'h-9 px-4 text-sm': size === 'sm',
            'h-10 px-4 py-2': size === 'md',
            'h-11 px-8': size === 'lg',
          },
          {
            'cursor-not-allowed opacity-50': props.disabled || loading,
          },
          className
        )}
        {...props}
      >
        <span className="inline-flex items-center justify-center">{content}</span>
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export default Button;
