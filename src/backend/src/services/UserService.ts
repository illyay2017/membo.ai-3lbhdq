/**
 * @fileoverview Enhanced UserService implementation for membo.ai with comprehensive
 * security features, role-based access control, and audit logging
 * @version 1.0.0
 */

import bcrypt from 'bcryptjs'; // v5.1.1
import winston from 'winston'; // v3.8.2
import jwt from 'jsonwebtoken'; // v9.0.0
import { IUser } from '../interfaces/IUser';
import { User } from '../models/User';
import { UserRole } from '../constants/userRoles';
import { encryptField } from '../utils/encryption';

/**
 * Rate limit configurations per user role
 */
const RATE_LIMITS = {
  [UserRole.FREE_USER]: parseInt(process.env.RATE_LIMIT_FREE_TIER || '100'),
  [UserRole.PRO_USER]: parseInt(process.env.RATE_LIMIT_PRO_TIER || '1000'),
  [UserRole.POWER_USER]: 2000,
  [UserRole.ENTERPRISE_ADMIN]: 5000,
  [UserRole.SYSTEM_ADMIN]: Infinity
};

/**
 * Security configuration constants
 */
const SECURITY_CONFIG = {
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
    maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
  },
  tokens: {
    accessExpiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    algorithm: 'HS256'
  },
  lockout: {
    maxAttempts: 5,
    duration: 15 * 60 * 1000 // 15 minutes
  }
};

/**
 * Enhanced UserService class implementing secure user management operations
 */
export class UserService {
  private logger: winston.Logger;
  private userModel: typeof User;

  constructor() {
    // Initialize secure logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'user-service' },
      transports: [
        new winston.transports.File({ filename: 'logs/user-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/user-security.log', level: 'warn' }),
        new winston.transports.File({ filename: 'logs/user-combined.log' })
      ]
    });

    this.userModel = User;
  }

  /**
   * Validates password against security policy
   * @throws Error if password doesn't meet requirements
   */
  private validatePassword(password: string): void {
    const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecial } = SECURITY_CONFIG.passwordPolicy;

    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }
    if (requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Generates JWT tokens for authentication
   */
  private generateTokens(user: IUser): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: SECURITY_CONFIG.tokens.accessExpiry,
      algorithm: SECURITY_CONFIG.tokens.algorithm as jwt.Algorithm
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: SECURITY_CONFIG.tokens.refreshExpiry,
      algorithm: SECURITY_CONFIG.tokens.algorithm as jwt.Algorithm
    });

    return { accessToken, refreshToken };
  }

  /**
   * Registers a new user with enhanced security validation
   */
  public async register(userData: Partial<IUser>): Promise<{ user: IUser; tokens: { accessToken: string; refreshToken: string } }> {
    try {
      // Validate password security
      this.validatePassword(userData.password!);

      // Check for existing user
      const existingUser = await this.userModel.findByEmail(userData.email!);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password!, 12);

      // Create user with encrypted sensitive data
      const userWithEncryptedData = encryptField({
        ...userData,
        password: hashedPassword,
        role: UserRole.FREE_USER,
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }, 'email');

      const user = await this.userModel.create(userWithEncryptedData);
      const tokens = this.generateTokens(user);

      this.logger.info('User registered successfully', { userId: user.id });

      return { user, tokens };
    } catch (error) {
      this.logger.error('User registration failed', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Authenticates user with enhanced security checks
   */
  public async login(email: string, password: string): Promise<{ user: IUser; tokens: { accessToken: string; refreshToken: string } }> {
    try {
      const user = await this.userModel.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check account status
      if (!user.isActive) {
        throw new Error('Account is disabled');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        await this.handleFailedLogin(user);
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Update login timestamp and reset failed attempts
      await this.userModel.update(user.id, {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        accountLockoutUntil: null
      });

      this.logger.info('User logged in successfully', { userId: user.id });

      return { user, tokens };
    } catch (error) {
      this.logger.error('Login failed', { error, email });
      throw error;
    }
  }

  /**
   * Handles failed login attempts and account lockout
   */
  private async handleFailedLogin(user: IUser): Promise<void> {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updates: Partial<IUser> = { failedLoginAttempts: attempts };

    if (attempts >= SECURITY_CONFIG.lockout.maxAttempts) {
      updates.accountLockoutUntil = new Date(Date.now() + SECURITY_CONFIG.lockout.duration);
      this.logger.warn('Account locked due to failed attempts', { userId: user.id });
    }

    await this.userModel.update(user.id, updates);
  }

  /**
   * Refreshes authentication tokens
   */
  public async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload;
      const user = await this.userModel.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      this.logger.error('Token refresh failed', { error });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Updates user profile with security validation
   */
  public async updateProfile(userId: string, updates: Partial<IUser>): Promise<IUser> {
    try {
      // Prevent critical field updates
      delete updates.password;
      delete updates.role;
      delete updates.isActive;
      delete updates.isEmailVerified;

      const updatedUser = await this.userModel.update(userId, {
        ...updates,
        updatedAt: new Date()
      });

      this.logger.info('Profile updated successfully', { userId });
      return updatedUser;
    } catch (error) {
      this.logger.error('Profile update failed', { error, userId });
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();
Object.freeze(userService);