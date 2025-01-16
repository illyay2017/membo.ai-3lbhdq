import winston from 'winston'; // version: ^3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // version: ^4.7.1
import { ProcessEnv } from '../types/environment';

// Constants for file logging configuration
const LOG_FILE_PATH = './logs/%DATE%.log';
const MAX_LOG_FILES = '14d';
const MAX_FILE_SIZE = '20m';

/**
 * Retrieves and validates the log level from environment variables
 * @returns {string} Validated log level
 */
const getLogLevel = (): string => {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  const validLevels = ['error', 'warn', 'info', 'debug'];
  return validLevels.includes(level as string) ? level as string : 'info';
};

/**
 * Creates environment-specific log format configuration
 * @returns {winston.Logform.Format} Configured log format
 */
const getLogFormat = (): winston.Logform.Format => {
  const { combine, timestamp, printf, json, colorize, errors } = winston.format;

  // Common format elements
  const baseFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true })
  );

  if (process.env.NODE_ENV === 'development') {
    return combine(
      baseFormat,
      colorize({ all: true }),
      printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${stack ? `\n${stack}` : ''}${metaString}`;
      })
    );
  }

  // Production format with structured logging
  return combine(
    baseFormat,
    json(),
    winston.format((info) => {
      // Sanitize sensitive data
      if (info.password) info.password = '[REDACTED]';
      if (info.token) info.token = '[REDACTED]';
      if (info.apiKey) info.apiKey = '[REDACTED]';
      
      // Add service context
      info.service = 'membo.ai';
      info.environment = process.env.NODE_ENV;
      
      return info;
    })()
  );
};

/**
 * Creates a production file transport with rotation and security settings
 * @returns {winston.transport} Configured rotating file transport
 */
const createFileTransport = (): DailyRotateFile => {
  return new DailyRotateFile({
    filename: LOG_FILE_PATH,
    datePattern: 'YYYY-MM-DD',
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_LOG_FILES,
    format: getLogFormat(),
    zippedArchive: true,
    // Security settings
    handleExceptions: true,
    handleRejections: true,
    // File permissions (only owner can read/write)
    options: { mode: 0o600 }
  });
};

/**
 * Configure transports based on environment
 */
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: getLogFormat()
  })
];

// Add file transport in production and staging
if (process.env.NODE_ENV !== 'development') {
  transports.push(createFileTransport());
}

/**
 * Configured Winston logger instance
 */
export const logger = winston.createLogger({
  level: getLogLevel(),
  transports,
  // Exit on error: false to prevent process termination on uncaught errors
  exitOnError: false,
  // Enable exception handling
  handleExceptions: true,
  handleRejections: true,
  // Default metadata
  defaultMeta: {
    service: 'membo.ai',
    version: process.env.API_VERSION
  }
});

// Export individual log level functions for convenience
export const error = logger.error.bind(logger);
export const warn = logger.warn.bind(logger);
export const info = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);