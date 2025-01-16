/**
 * @fileoverview Enhanced UserController implementation with comprehensive security,
 * performance optimization, and audit logging for membo.ai
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { UserService } from '../../services/UserService';
import { IUser } from '../../interfaces/IUser';
import { validateRequest } from '../middlewares/validation.middleware';
import { ErrorCodes, createErrorDetails } from '../../constants/errorCodes';

/**
 * Enhanced UserController handling user-related HTTP requests with security features
 */
export class UserController {
  private userService: UserService;
  private requestCount: Map<string, number>;
  private lastRequestTime: Map<string, number>;

  constructor() {
    this.userService = new UserService();
    this.requestCount = new Map();
    this.lastRequestTime = new Map();
  }

  /**
   * Handles user registration with enhanced security validation
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      // Apply rate limiting
      const clientIp = req.ip;
      if (!this.checkRateLimit(clientIp, 'register', 5)) {
        return res.status(429).json(
          createErrorDetails(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            'Too many registration attempts',
            req.path
          )
        );
      }

      // Validate request data
      await validateRequest(req, res, next);

      const userData: Partial<IUser> = {
        email: req.body.email.toLowerCase(),
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        preferences: req.body.preferences
      };

      const { user, tokens } = await this.userService.register(userData);

      // Remove sensitive data before sending response
      const sanitizedUser = this.sanitizeUserData(user);

      return res.status(201).json({
        status: 'success',
        data: {
          user: sanitizedUser,
          tokens
        }
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Handles user login with progressive rate limiting
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      // Apply progressive rate limiting
      const clientIp = req.ip;
      if (!this.checkRateLimit(clientIp, 'login', 3)) {
        return res.status(429).json(
          createErrorDetails(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            'Too many login attempts',
            req.path
          )
        );
      }

      await validateRequest(req, res, next);

      const { email, password } = req.body;
      const { user, tokens } = await this.userService.login(email, password);

      // Set secure cookie with refresh token
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const sanitizedUser = this.sanitizeUserData(user);

      return res.status(200).json({
        status: 'success',
        data: {
          user: sanitizedUser,
          accessToken: tokens.accessToken
        }
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Handles token refresh with enhanced security
   */
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json(
          createErrorDetails(
            ErrorCodes.UNAUTHORIZED,
            'Refresh token is required',
            req.path
          )
        );
      }

      const tokens = await this.userService.refreshToken(refreshToken);

      // Update secure cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        status: 'success',
        data: {
          accessToken: tokens.accessToken
        }
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Handles user profile updates with enhanced validation
   */
  public updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      await validateRequest(req, res, next);

      const userId = req.user.id;
      const updates: Partial<IUser> = {
        firstName: req.body.firstName,
        lastName: req.body.lastName
      };

      const updatedUser = await this.userService.updateProfile(userId, updates);
      const sanitizedUser = this.sanitizeUserData(updatedUser);

      return res.status(200).json({
        status: 'success',
        data: {
          user: sanitizedUser
        }
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Handles user preferences update with validation and caching
   */
  public updatePreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      await validateRequest(req, res, next);

      const userId = req.user.id;
      const preferences = req.body.preferences;

      const updatedUser = await this.userService.updatePreferences(userId, preferences);
      const sanitizedUser = this.sanitizeUserData(updatedUser);

      return res.status(200).json({
        status: 'success',
        data: {
          user: sanitizedUser
        }
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Handles email verification with security checks
   */
  public verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json(
          createErrorDetails(
            ErrorCodes.BAD_REQUEST,
            'Verification token is required',
            req.path
          )
        );
      }

      await this.userService.verifyEmail(token);

      return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully'
      });
    } catch (error) {
      return this.handleError(error, req, res);
    }
  };

  /**
   * Implements progressive rate limiting
   */
  private checkRateLimit(clientIp: string, action: string, maxAttempts: number): boolean {
    const key = `${clientIp}:${action}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    const count = this.requestCount.get(key) || 0;
    const lastRequest = this.lastRequestTime.get(key) || 0;

    if (now - lastRequest > windowMs) {
      this.requestCount.set(key, 1);
      this.lastRequestTime.set(key, now);
      return true;
    }

    if (count >= maxAttempts) {
      return false;
    }

    this.requestCount.set(key, count + 1);
    this.lastRequestTime.set(key, now);
    return true;
  }

  /**
   * Removes sensitive data from user object
   */
  private sanitizeUserData(user: IUser): Partial<IUser> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Handles errors with proper logging and response formatting
   */
  private handleError(error: any, req: Request, res: Response): Response {
    console.error('[UserController Error]:', {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    const errorDetails = createErrorDetails(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'An error occurred while processing your request',
      req.path
    );

    return res.status(errorDetails.status).json(errorDetails);
  }
}

// Export singleton instance
export const userController = new UserController();
Object.freeze(userController);