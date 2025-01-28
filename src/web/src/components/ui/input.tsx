/**
 * A reusable input component with comprehensive validation, accessibility features,
 * and security measures for the membo.ai web application
 * @version 1.0.0
 */

import React, { useCallback, useRef } from 'react';
import { sanitizeInput } from '../../utils/validation'; // v1.0.0
import { cn } from '../../lib/utils';

// Input types supported by the component
type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur'> {
  id: string;
  name: string;
  label?: string;
  placeholder?: string;
  value?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  type?: InputType;
  inputMode?: InputMode;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  onChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
}

/**
 * Input component with comprehensive validation and accessibility features
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ id, name, label, placeholder, value, error, className, disabled = false, required = false, type = 'text', inputMode, pattern, maxLength, minLength, autoComplete, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, onChange, onBlur, onFocus, ...props }, ref) => {
    // Unique IDs for accessibility
    const errorId = useRef(`${id}-error`);
    const labelId = useRef(`${id}-label`);

    // Debounced input change handler with validation
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement> | string) => {
        const rawValue = typeof event === 'string' ? event : event.target.value;
        const sanitizedValue = sanitizeInput(rawValue);

        if (pattern && !new RegExp(pattern).test(sanitizedValue)) {
          return;
        }

        if (maxLength && sanitizedValue.length > maxLength) {
          return;
        }

        if (onChange) {
          onChange(sanitizedValue);
        }
      },
      [onChange, pattern, maxLength]
    );

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', className)}>
        {/* Input Label */}
        {label && (
          <label
            htmlFor={id}
            id={labelId.current}
            className="text-sm font-medium text-gray-700 select-none"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input Field */}
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          pattern={pattern}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-label={ariaLabel || label}
          aria-describedby={cn(
            error ? errorId.current : undefined,
            ariaDescribedBy
          )}
          className={cn(
            'px-3 py-2 rounded-md border border-gray-300 w-full',
            'transition-colors duration-200 ease-in-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            {
              'bg-gray-100 cursor-not-allowed opacity-75': disabled,
              'border-red-500 focus:ring-red-500': error,
            }
          )}
          {...props}
        />

        {/* Error Message */}
        {error && (
          <div
            id={errorId.current}
            role="alert"
            className="text-sm text-red-500 mt-1 flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
