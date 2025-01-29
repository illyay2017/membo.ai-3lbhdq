/**
 * @fileoverview Enhanced authentication controller implementing secure user authentication,
 * comprehensive validation, and RFC 7807 compliant error handling.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^3.0.0
import winston from 'winston'; // ^3.8.2
import { AuthService } from '../../services/AuthService';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';

// Configure secure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'auth-controller' },
  transports: [
    new winston.transports.File({ filename: 'logs/auth-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/auth-combined.log' })
  ]
});

/**
 * Enhanced authentication controller with security features and comprehensive error handling
 */
export class AuthController {
  private readonly authService: AuthService;
  private readonly rateLimiter: RateLimiterRedis;

  constructor(authService: AuthService, rateLimiter: RateLimiterRedis) {
    this.authService = authService;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Handles user registration with enhanced security and validation
   */
  public register = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Add security metadata
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId: req.headers['x-device-id'],
        geoLocation: {
          country: req.headers['cf-ipcountry'],
          region: req.headers['cf-region']
        }
      };

      // Validate registration request
      const validationResult = await validateRegistrationRequest({
        ...req.body,
        metadata
      });

      if (!validationResult.isValid) {
        return res.status(422).json(createErrorDetails(
          ErrorCodes.VALIDATION_ERROR,
          validationResult.errors[0].message,
          req.originalUrl
        ));
      }

      // Register user
      const { user, token, refreshToken } = await this.authService.register(req.body);

      // Set security headers
      res.set({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Set secure cookies
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      logger.info('User registered successfully', { userId: user.id });

      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        token
      });
    } catch (error) {
      logger.error('Registration failed', { error, path: req.path });
      return res.status(500).json(createErrorDetails(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Registration failed. Please try again later.',
        req.originalUrl
      ));
    }
  };

  /**
   * Handles user login with rate limiting and security measures
   */
  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Add debug logging
      console.log('Login request received:');
      console.log('Full URL:', req.originalUrl);
      console.log('Base URL:', req.baseUrl);
      console.log('Path:', req.path);
      console.log('Headers:', req.headers);
      console.log('Body:', { ...req.body, password: '***' });
      console.log('IP:', req.ip);

      // Check rate limiting
      try {
        await this.rateLimiter.consume(req.ip);
      } catch (error) {
        return res.status(429).json(createErrorDetails(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          'Too many login attempts. Please try again later.',
          req.originalUrl
        ));
      }

      // Add security metadata
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId: req.headers['x-device-id']
      };

      // Validate login request
      const validationResult = await validateLoginRequest({
        ...req.body,
        metadata
      });

      if (!validationResult.isValid) {
        return res.status(422).json(createErrorDetails(
          ErrorCodes.VALIDATION_ERROR,
          validationResult.errors[0].message,
          req.originalUrl
        ));
      }

      // Authenticate user
      const { user, token, refreshToken } = await this.authService.login(
        req.body.email,
        req.body.password
      );

      // Set security headers
      res.set({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Set secure cookies
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      logger.info('User logged in successfully', { userId: user.id });

      // Log response
      console.log('Sending response:', {
        status: 200,
        user: user.id,
        tokensPresent: !!token && !!refreshToken
      });

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      logger.error('Login failed', { error, path: req.path });
      return res.status(401).json(createErrorDetails(
        ErrorCodes.UNAUTHORIZED,
        'Invalid credentials',
        req.originalUrl
      ));
    }
  };

  /**
   * Handles token refresh with security validation
   */
  public refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json(createErrorDetails(
          ErrorCodes.UNAUTHORIZED,
          'Refresh token is required',
          req.originalUrl
        ));
      }

      const { token, refreshToken: newRefreshToken } = await this.authService.refreshAccessToken(refreshToken);

      // Set secure cookies
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.status(200).json({ token });
    } catch (error) {
      logger.error('Token refresh failed', { error, path: req.path });
      return res.status(401).json(createErrorDetails(
        ErrorCodes.UNAUTHORIZED,
        'Invalid refresh token',
        req.originalUrl
      ));
    }
  };

  /**
   * Handles secure user logout
   */
  public logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const refreshToken = req.cookies.refreshToken;

      if (!token || !refreshToken) {
        return res.status(401).json(createErrorDetails(
          ErrorCodes.UNAUTHORIZED,
          'Authentication tokens required',
          req.originalUrl
        ));
      }

      await this.authService.logout(token, refreshToken);

      // Clear secure cookies
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      logger.info('User logged out successfully');

      return res.status(200).json({
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout failed', { error, path: req.path });
      return res.status(500).json(createErrorDetails(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Logout failed. Please try again later.',
        req.originalUrl
      ));
    }
  };
}
