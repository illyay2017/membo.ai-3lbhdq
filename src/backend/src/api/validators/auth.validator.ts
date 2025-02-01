import Joi from 'joi'; // ^17.9.0
import { validateSchema, validateEmail, validatePassword, ValidationResult } from '../../utils/validation';
import { IUser } from '../../interfaces/IUser';

// Cache for rate limiting - stores IP/email combinations with timestamps
const rateLimitCache = new Map<string, { attempts: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

// Metadata validation schema for tracking security context
const metadataSchema = Joi.object({
  ipAddress: Joi.string().optional(),
  userAgent: Joi.string().optional(),
  deviceId: Joi.string().optional(),
  geoLocation: Joi.object({
    country: Joi.string(),
    region: Joi.string()
  }).optional()
}).optional();

// Login request validation schema
const LOGIN_SCHEMA = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .custom(async (value, helpers) => {
      try {
        const result = await validateEmail(value, { checkMX: true, checkDisposable: true });
        if (!result.isValid) {
          return helpers.error('any.invalid', { 
            message: result.errors?.[0]?.message || 'Invalid email'
          });
        }
        return value;
      } catch (error) {
        console.error('Email validation error:', error);
        return helpers.error('any.invalid', { 
          message: 'Email validation failed'
        });
      }
    }),
  password: Joi.string()
    .required()
    .custom((value, helpers) => {
      try {
        const result = validatePassword(value, { calculateStrength: true });
        if (!result.isValid) {
          return helpers.error('any.invalid', { 
            message: result.errors?.[0]?.message || 'Invalid password'
          });
        }
        return value;
      } catch (error) {
        console.error('Password validation error:', error);
        return helpers.error('any.invalid', { 
          message: 'Password validation failed'
        });
      }
    }),
  metadata: metadataSchema
});

// Registration request validation schema with enhanced security
const REGISTRATION_SCHEMA = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .custom(async (value, helpers) => {
      const result = await validateEmail(value, {
        checkMX: true,
        checkDisposable: true,
        checkReputation: true
      });
      if (!result.isValid) {
        return helpers.error('any.invalid', { 
          message: result.errors?.[0]?.message || 'Invalid email'
        });
      }
      return value;
    }),
  password: Joi.string()
    .required()
    .min(8)
    .custom((value, helpers) => {
      const result = validatePassword(value, {
        minLength: 8,
        checkCommonPasswords: true,
        calculateStrength: true
      });
      if (!result.isValid || result.metadata?.strength < 70) {
        return helpers.error('any.invalid', {
          message: 'Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters'
        });
      }
      return value;
    }),
  firstName: Joi.string()
    .required()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s-']+$/, { name: 'valid name characters' }),
  lastName: Joi.string()
    .required()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s-']+$/, { name: 'valid name characters' }),
  captchaToken: Joi.string()
    .when('$isProduction', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  metadata: metadataSchema
});

// Password reset request validation schema
const PASSWORD_RESET_SCHEMA = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .custom((value, helpers) => {
      const result = validateEmail(value, { checkMX: true });
      if (!result.isValid) {
        return helpers.error(result.errors[0].message);
      }
      return value;
    }),
  metadata: metadataSchema
});

/**
 * Validates login request data with rate limiting and security checks
 * @param requestData - Login request data to validate
 * @returns Validation result with security metadata
 */
export const validateLoginRequest = async (data: any): Promise<ValidationResult> => {
  try {
    // Ensure metadata exists
    const metadata = data.metadata || {
      ipAddress: 'unknown',
      userAgent: 'unknown',
      deviceId: undefined
    };

    const validationResult = await LOGIN_SCHEMA.validateAsync({
      ...data,
      metadata
    });

    return {
      isValid: true,
      errors: [],
      metadata: {},
      data: validationResult
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [{ message: error.message }],
      metadata: {}
    };
  }
};

/**
 * Validates registration request data with enhanced security measures
 * @param requestData - Registration request data to validate
 * @returns Validation result with security metadata
 */
export const validateRegistrationRequest = async (
  requestData: Partial<IUser & { metadata: any }>
): Promise<ValidationResult> => {
  const { metadata: { ipAddress } } = requestData;
  const now = Date.now();

  // Check IP-based rate limiting for registrations
  const rateLimit = rateLimitCache.get(ipAddress) || { attempts: 0, lastAttempt: now };
  if (rateLimit.attempts >= 3 && (now - rateLimit.lastAttempt) < RATE_LIMIT_WINDOW) {
    return {
      isValid: false,
      errors: [{
        field: 'registration',
        message: 'Too many registration attempts from this IP',
        code: 'rate_limit_exceeded',
        severity: 'error'
      }]
    };
  }

  // Validate request data
  const validationResult = await validateSchema(REGISTRATION_SCHEMA, requestData);

  // Update rate limiting for IP
  if (!validationResult.isValid) {
    rateLimitCache.set(ipAddress, {
      attempts: rateLimit.attempts + 1,
      lastAttempt: now
    });
  }

  return {
    ...validationResult,
    metadata: {
      ...validationResult.metadata,
      ipAddress,
      timestamp: now
    }
  };
};

/**
 * Validates password reset request data with security measures
 * @param requestData - Password reset request data to validate
 * @returns Validation result with security metadata
 */
export const validatePasswordResetRequest = async (requestData: Partial<IUser & { metadata: any }>) => {
  const { email, metadata: { ipAddress } } = requestData;
  const cacheKey = `reset:${ipAddress}:${email}`;
  const now = Date.now();

  // Check rate limiting for reset requests
  const rateLimit = rateLimitCache.get(cacheKey) || { attempts: 0, lastAttempt: now };
  if (rateLimit.attempts >= 3 && (now - rateLimit.lastAttempt) < RATE_LIMIT_WINDOW) {
    return {
      isValid: false,
      errors: [{
        field: 'reset',
        message: 'Too many reset attempts. Please try again later.',
        code: 'rate_limit_exceeded',
        severity: 'error'
      }]
    };
  }

  // Validate request data
  const validationResult = await validateSchema(PASSWORD_RESET_SCHEMA, requestData);

  // Update rate limiting cache
  if (!validationResult.isValid) {
    rateLimitCache.set(cacheKey, {
      attempts: rateLimit.attempts + 1,
      lastAttempt: now
    });
  }

  return {
    ...validationResult,
    metadata: {
      ...validationResult.metadata,
      attempts: rateLimit.attempts + 1,
      ipAddress,
      timestamp: now
    }
  };
};
