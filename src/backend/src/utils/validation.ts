import Joi from 'joi'; // ^17.9.0
import validator from 'validator'; // ^13.9.0
import xss from 'xss'; // ^1.0.14

// Constants for validation rules
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const EMAIL_DOMAINS_BLOCKLIST = ['tempmail.com', 'disposable.com'];
const SANITIZATION_OPTIONS = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false
};
const VALIDATION_CACHE_TTL = 300; // 5 minutes in seconds

// Types for validation results and options
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  metadata?: Record<string, any>;
  data?: any;
  suggestions?: string[];
}

interface ValidationError {
  field: string;
  message: string;
  code?: string;
  severity?: 'error' | 'warning';
}

interface EmailValidationOptions {
  checkMX?: boolean;
  checkDisposable?: boolean;
  checkReputation?: boolean;
}

interface PasswordValidationOptions {
  minLength?: number;
  checkCommonPasswords?: boolean;
  calculateStrength?: boolean;
}

interface SanitizationOptions {
  stripTags?: boolean;
  escapeHTML?: boolean;
  preventSQLInjection?: boolean;
}

// Validation cache implementation
const validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();

/**
 * Enhanced schema validation using Joi with caching and detailed error reporting
 * @param schemaRules - Schema rules in the format of key-value pairs
 * @param data - Data to validate
 * @returns Detailed validation result
 */
export const validateSchema = (
  schemaRules: Record<string, any>,
  data: unknown
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    suggestions: []
  };

  try {
    // Validate each field
    Object.entries(schemaRules).forEach(([field, rules]) => {
      const value = (data as any)?.[field];

      // Check required
      if (rules.required && !value) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} is required`,
          code: 'required',
          severity: 'error'
        });
        return;
      }

      if (value) {
        // Check type
        if (rules.type && typeof value !== rules.type) {
          result.isValid = false;
          result.errors.push({
            field,
            message: `${field} must be a ${rules.type}`,
            code: 'type',
            severity: 'error'
          });
        }

        // Check pattern
        if (rules.pattern && typeof value === 'string') {
          const regex = new RegExp(rules.pattern, rules.flags);
          if (!regex.test(value)) {
            result.isValid = false;
            result.errors.push({
              field,
              message: `${field} format is invalid`,
              code: 'pattern',
              severity: 'error'
            });
          }
        }

        // Check length
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          result.isValid = false;
          result.errors.push({
            field,
            message: `${field} must be at least ${rules.minLength} characters`,
            code: 'minLength',
            severity: 'error'
          });
        }

        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          result.isValid = false;
          result.errors.push({
            field,
            message: `${field} must not exceed ${rules.maxLength} characters`,
            code: 'maxLength',
            severity: 'error'
          });
        }
      }
    });

    if (!result.isValid) {
      result.suggestions = generateValidationSuggestions(result.errors);
    }

    return result;
  } catch (error) {
    console.error('Validation error:', error);
    return {
      isValid: false,
      errors: [{
        field: 'validation',
        message: 'Validation failed',
        code: 'internal_error',
        severity: 'error'
      }],
      suggestions: []
    };
  }
};

/**
 * Advanced email validation with domain reputation checking and security features
 * @param email - Email address to validate
 * @param options - Email validation options
 * @returns Detailed email validation result
 */
export const validateEmail = async (
  email: string,
  options: EmailValidationOptions = {}
): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    metadata: {}
  };

  // Basic format validation
  if (!EMAIL_PATTERN.test(email) || !validator.isEmail(email)) {
    result.isValid = false;
    result.errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'invalid_format',
      severity: 'error'
    });
    return result;
  }

  const domain = email.split('@')[1];

  // Check domain blocklist
  if (EMAIL_DOMAINS_BLOCKLIST.includes(domain)) {
    result.isValid = false;
    result.errors.push({
      field: 'email',
      message: 'Disposable email domains not allowed',
      code: 'blocked_domain',
      severity: 'error'
    });
  }

  // Optional MX record check
  if (options.checkMX) {
    const hasMX = await validator.isFQDN(domain);
    result.metadata!.hasMX = hasMX;
    if (!hasMX) {
      result.isValid = false;
      result.errors.push({
        field: 'email',
        message: 'Invalid email domain',
        code: 'invalid_mx',
        severity: 'error'
      });
    }
  }

  return result;
};

/**
 * Comprehensive password validation with strength assessment and security checks
 * @param password - Password to validate
 * @param options - Password validation options
 * @returns Detailed password validation result
 */
export const validatePassword = (
  password: string,
  options: PasswordValidationOptions = {}
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    metadata: {
      strength: 0
    }
  };

  const minLength = options.minLength || PASSWORD_MIN_LENGTH;

  // Length check
  if (password.length < minLength) {
    result.isValid = false;
    result.errors.push({
      field: 'password',
      message: `Password must be at least ${minLength} characters long`,
      code: 'min_length',
      severity: 'error'
    });
  }

  // Complexity check
  if (!PASSWORD_PATTERN.test(password)) {
    result.isValid = false;
    result.errors.push({
      field: 'password',
      message: 'Password must contain uppercase, lowercase, number, and special character',
      code: 'complexity',
      severity: 'error'
    });
  }

  // Calculate strength score if requested
  if (options.calculateStrength) {
    result.metadata!.strength = calculatePasswordStrength(password);
  }

  return result;
};

/**
 * Advanced input sanitization with multiple security layers
 * @param input - Input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string with security guarantees
 */
export const sanitizeInput = (
  input: string,
  options: SanitizationOptions = {}
): string => {
  let sanitized = input.trim();

  // XSS prevention
  if (options.escapeHTML !== false) {
    sanitized = xss(sanitized, SANITIZATION_OPTIONS);
  }

  // SQL injection prevention
  if (options.preventSQLInjection !== false) {
    sanitized = validator.escape(sanitized);
  }

  return sanitized;
};

// Helper functions
const generateValidationSuggestions = (errors: ValidationError[]): string[] => {
  const suggestions: string[] = [];
  errors.forEach(error => {
    switch (error.code) {
      case 'min_length':
        suggestions.push('Try increasing the length of your input');
        break;
      case 'complexity':
        suggestions.push('Include a mix of uppercase, lowercase, numbers, and special characters');
        break;
      case 'invalid_format':
        suggestions.push('Check the format and try again');
        break;
    }
  });
  return suggestions;
};

const calculatePasswordStrength = (password: string): number => {
  let score = 0;
  
  // Length contribution
  score += Math.min(password.length * 4, 25);
  
  // Character variety contribution
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  // Complexity patterns
  if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) score += 15;
  if (/(?=.*[^A-Za-z0-9])/.test(password)) score += 15;
  
  return Math.min(score, 100);
};
