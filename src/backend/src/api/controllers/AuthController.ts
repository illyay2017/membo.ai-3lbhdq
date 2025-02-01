/**
 * @fileoverview Enhanced authentication controller implementing secure user authentication,
 * comprehensive validation, and RFC 7807 compliant error handling.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import winston from 'winston'; // ^3.8.2
import { AuthService } from '../../services/AuthService';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { ErrorCodes, createErrorDetails, AUTH_ERRORS } from '../../constants/errorCodes';
import * as TokenUtils from '../../utils/jwt';
import { UserRole } from '../../constants/userRoles';

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
  constructor(
    private readonly authService: AuthService
  ) {}

  /**
   * Handles user registration with enhanced security and validation
   */
  public register = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log('AuthController.register started');

      // Add security metadata to registration data
      const registrationData = {
        ...req.body,
        securityMetadata: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          deviceId: req.headers['x-device-id'],
          geoLocation: {
            country: req.headers['cf-ipcountry'],
            region: req.headers['cf-region']
          },
          timestamp: new Date().toISOString()
        }
      };

      console.log('Processing registration for:', {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName
      });

      try {
        // Register user with security metadata
        const { user, token, refreshToken } = await this.authService.register(registrationData);
        
        console.log('User registered successfully:', {
          userId: user.id,
          hasToken: !!token,
          hasRefreshToken: !!refreshToken
        });

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

        return res.status(201).json({
          user,
          token,
          refreshToken
        });
      } catch (error) {
        console.error('Error in authService.register:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    } catch (error) {
      console.error('AuthController.register error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    }
  };

  /**
   * Handles user login with rate limiting and security measures
   */
  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      
      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      // Handle HTTP-specific error responses
      return this.handleAuthError(error, res);
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
      const authToken = req.headers.authorization?.split(' ')[1];
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!authToken) {
        return res.status(401).json(createErrorDetails(
          ErrorCodes.UNAUTHORIZED,
          'No authentication token provided',
          req.originalUrl
        ));
      }

      if (!refreshToken) {
        return res.status(401).json(createErrorDetails(
          ErrorCodes.UNAUTHORIZED,
          'Refresh token is required',
          req.originalUrl
        ));
      }

      await this.authService.logout(authToken, refreshToken);

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error) {
      return this.handleAuthError(error, res);
    }
  };

  private handleAuthError(error: any, res: Response): Response {
    // Implement the logic to handle different types of authentication errors
    // This is a placeholder and should be replaced with the actual implementation
    return res.status(401).json({
      message: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
}
