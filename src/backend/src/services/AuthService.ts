/**
 * @fileoverview Authentication service implementing secure user authentication,
 * authorization, and session management with comprehensive security features.
 * @version 1.0.0
 */

import { createClient } from 'redis'; // v4.6.8
import { IUser } from '../interfaces/IUser';
import { createSupabaseClient } from '../config/supabase';
import { UserRole } from '../constants/userRoles';
import { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { TokenService } from './TokenService';
import { RedisService } from './RedisService';

/**
 * Define interface for registration request data
 */
interface IRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  securityMetadata?: {
    ipAddress: string;
    userAgent: string;
    deviceId?: string;
    geoLocation?: {
      country?: string;
      region?: string;
    };
    timestamp: string;
  };
}

/**
 * Interface for authentication response
 */
interface AuthResponse {
  user: Pick<IUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>;
  token: string;
  refreshToken: string;
}

/**
 * Rate limit configuration by user role
 */
const RATE_LIMITS = {
  FREE_USER: parseInt(process.env.RATE_LIMIT_FREE_TIER || '100'),
  PRO_USER: parseInt(process.env.RATE_LIMIT_PRO_TIER || '1000'),
  POWER_USER: 2000,
  ENTERPRISE_ADMIN: 5000,
  SYSTEM_ADMIN: Infinity
};

/**
 * Service class implementing secure authentication and authorization
 */
export class AuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tokenService: TokenService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Registers a new user with secure password handling
   * @param userData User registration data
   * @returns Authentication response with tokens
   */
  public async register(userData: IRegistrationData): Promise<AuthResponse> {
    try {
      this.validatePassword(userData.password);

      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            registrationMetadata: userData.securityMetadata
          }
        }
      });

      if (authError) throw new Error(`Registration failed: ${authError.message}`);
      if (!authData.user) throw new Error('Registration failed: No user data returned');

      // Log security event
      console.log('User registration:', {
        userId: authData.user.id,
        email: userData.email,
        metadata: userData.securityMetadata,
        timestamp: new Date().toISOString()
      });

      // Create user object conforming to IUser interface
      const user: Pick<IUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role'> = {
        id: authData.user.id,
        email: authData.user.email!,
        firstName: authData.user.user_metadata.firstName,
        lastName: authData.user.user_metadata.lastName,
        role: UserRole.FREE_USER
      };

      const tokens = await this.tokenService.generateTokenPair(user as IUser);
      
      return { 
        user, 
        token: tokens.accessToken, 
        refreshToken: tokens.refreshToken 
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticates user with rate limiting and security monitoring
   * @param email User email
   * @param password User password
   * @returns Authentication response with tokens
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting login with Supabase...');
      
      const { data: auth, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Supabase auth error:', error);
        throw new AuthError(error.message);
      }

      if (!auth?.user) {
        throw new Error('No user data returned from Supabase');
      }

      // Map Supabase user to IUser
      const user: IUser = {
        id: auth.user.id,
        email: auth.user.email!,
        firstName: auth.user.user_metadata.firstName,
        lastName: auth.user.user_metadata.lastName,
        role: auth.user.user_metadata.role || UserRole.FREE_USER,
      } as IUser;

      const tokens = await this.tokenService.generateTokenPair(user);
      
      return {
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Unable to connect to authentication service. Please check if Supabase is running.');
      }
      throw error;
    }
  }

  /**
   * Logs out user and invalidates tokens
   * @param token Access token to invalidate
   * @param refreshToken Refresh token to invalidate
   */
  public async logout(token: string, refreshToken: string): Promise<void> {
    await this.tokenService.invalidateTokens(token, refreshToken);
    await this.supabase.auth.signOut();
  }

  /**
   * @todo Future feature: Sign out from all devices
   */
  public async logoutAllDevices(userId: string): Promise<void> {
    await this.tokenService.invalidateSession(userId);
    await this.supabase.auth.signOut();
  }

  /**
   * Validates password strength
   * @private
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Checks rate limiting for authentication attempts
   * @private
   */
  private async checkRateLimit(identifier: string): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${identifier}`;
    const attempts = await this.redisService.incr(key);
    
    if (attempts === 1) {
      await this.redisService.expire(key, 60 * 60); // 1 hour window
    }

    if (attempts > RATE_LIMITS.FREE_USER) {
      throw new Error('Rate limit exceeded');
    }
  }
}

/**
 * Clears all user sessions and invalidates all tokens across devices
 * @param userId User ID to clear all sessions for
 * @todo Implement "Sign out of all devices" feature using this method
 * @todo Add UI option for users to sign out everywhere
 * @todo Add to security audit logging
 */
export async function clearUserSession(userId: string): Promise<void> {
  try {
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Sign out from Supabase
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Supabase sign out error:', signOutError);
    }

    // Clear Redis session
    const redisClient = createClient({
      url: process.env.REDIS_URL
    });
    await redisClient.connect();
    
    try {
      await redisClient.del(`user_session:${userId}`);
    } finally {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Failed to clear user session:', error);
    // Continue with logout even if cleanup fails
  }
}
