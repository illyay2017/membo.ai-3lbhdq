import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.2
import Joi from 'joi'; // ^17.9.0
import { validateSchema, sanitizeInput } from '../../utils/validation';
import { ErrorCodes } from '../../constants/errorCodes';

// Cache for validation results with TTL
const validationCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Interface for validation middleware options
interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  sanitize?: boolean;
  enableCache?: boolean;
  validationTimeout?: number;
  securityLogging?: boolean;
}

// Default validation options
const defaultOptions: ValidationOptions = {
  stripUnknown: true,
  abortEarly: false,
  sanitize: true,
  enableCache: true,
  validationTimeout: 5000,
  securityLogging: true
};

/**
 * Creates an enhanced validation middleware with security features
 * @param schema - Joi validation schema
 * @param options - Validation configuration options
 * @returns Express middleware for request validation
 */
export const createValidationMiddleware = (
  schema: Joi.Schema,
  options: ValidationOptions = {}
): RequestHandler => {
  const finalOptions = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    let validationSource: 'body' | 'query' | 'params';
    let dataToValidate: unknown;

    // Determine validation source
    if (req.method === 'GET') {
      validationSource = 'query';
      dataToValidate = req.query;
    } else if (req.method === 'DELETE') {
      validationSource = 'params';
      dataToValidate = req.params;
    } else {
      validationSource = 'body';
      dataToValidate = req.body;
    }

    try {
      // Check validation cache if enabled
      if (finalOptions.enableCache) {
        const cacheKey = JSON.stringify({ schema, data: dataToValidate });
        const cached = validationCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          req[validationSource] = cached.result;
          return next();
        }
      }

      // Apply input sanitization if enabled
      if (finalOptions.sanitize) {
        dataToValidate = sanitizeRequestData(dataToValidate);
      }

      // Validate with timeout
      const validationPromise = validateSchema(schema, dataToValidate, {
        stripUnknown: finalOptions.stripUnknown,
        abortEarly: finalOptions.abortEarly
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Validation timeout exceeded'));
        }, finalOptions.validationTimeout);
      });

      const validationResult = await Promise.race([validationPromise, timeoutPromise]);

      // Log validation attempt if security logging is enabled
      if (finalOptions.securityLogging) {
        logValidationAttempt(req, validationResult);
      }

      if (!validationResult.isValid) {
        return res.status(422).json({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          errors: validationResult.errors,
          suggestions: validationResult.suggestions
        });
      }

      // Cache successful validation result
      if (finalOptions.enableCache) {
        const cacheKey = JSON.stringify({ schema, data: dataToValidate });
        validationCache.set(cacheKey, {
          result: validationResult.value,
          timestamp: Date.now()
        });
      }

      // Attach validated data to request
      req[validationSource] = validationResult.value;

      // Record validation performance
      const validationTime = Date.now() - startTime;
      recordValidationMetrics(validationTime);

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Generic request validation middleware
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export const validateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const schema = (req as any).validationSchema;
  
  if (!schema) {
    return next();
  }

  const middleware = createValidationMiddleware(schema);
  await middleware(req, res, next);
};

/**
 * Sanitizes request data recursively
 * @param data - Input data to sanitize
 * @returns Sanitized data
 */
const sanitizeRequestData = (data: any): any => {
  if (typeof data === 'string') {
    return sanitizeInput(data, {
      stripTags: true,
      escapeHTML: true,
      preventSQLInjection: true
    });
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeRequestData(value);
    }
    return sanitized;
  }

  return data;
};

/**
 * Logs validation attempts for security monitoring
 * @param req - Express request object
 * @param result - Validation result
 */
const logValidationAttempt = (req: Request, result: any): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    validationSuccess: result.isValid,
    errorCount: result.errors?.length || 0,
    userAgent: req.get('user-agent')
  };

  // Log to your preferred logging system
  console.log('[Validation Security Log]', JSON.stringify(logEntry));
};

/**
 * Records validation performance metrics
 * @param validationTime - Time taken for validation in milliseconds
 */
const recordValidationMetrics = (validationTime: number): void => {
  // Implement metrics recording logic (e.g., Prometheus metrics)
  console.log(`[Validation Metrics] Processing time: ${validationTime}ms`);
};