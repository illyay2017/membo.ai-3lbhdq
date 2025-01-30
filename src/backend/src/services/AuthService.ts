/**
 * @fileoverview Authentication service implementing secure user authentication,
 * authorization, and session management with comprehensive security features.
 * @version 1.0.0
 */

import { createClient } from 'redis'; // v4.6.8
import { IUser, IUserPreferences } from '../interfaces/IUser';
import { User } from '../models/User';
import * as TokenUtils from '../utils/jwt';
import { createSupabaseClient } from '../config/supabase';
import { UserRole } from '../constants/userRoles';

/**
 * Define interface for registration request data
 */
interface IRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
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
  private redisClient;
  private supabase;
  private readonly TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';
  private readonly RATE_LIMIT_PREFIX = 'rate:limit:';
  private readonly REFRESH_TOKEN_PREFIX = 'refresh:token:';

  constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.NODE_ENV === 'production',
        rejectUnauthorized: true
      }
    });
    
    this.supabase = createSupabaseClient();
    this.redisClient.connect().catch(console.error);
    this.setupTokenCleanup();

    console.log('AuthService initialized');
  }

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
            lastName: userData.lastName
          }
        }
      });

      if (authError) throw new Error(`Registration failed: ${authError.message}`);
      if (!authData.user) throw new Error('Registration failed: No user data returned');

      // Create user object conforming to IUser interface
      const user: Pick<IUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role'> = {
        id: authData.user.id,
        email: authData.user.email!,
        firstName: authData.user.user_metadata.firstName,
        lastName: authData.user.user_metadata.lastName,
        role: UserRole.FREE_USER
      };

      const [token, refreshToken] = await Promise.all([
        TokenUtils.generateToken(user).catch(error => {
          throw new Error(`Token generation failed: ${error.message}`);
        }),
        TokenUtils.generateRefreshToken(user).catch(error => {
          throw new Error(`Refresh token generation failed: ${error.message}`);
        })
      ]);

      await this.storeRefreshToken(user.id, refreshToken);

      return { user, token, refreshToken };
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
      console.log('AuthService.login called with:', { 
        email, 
        hasPassword: !!password 
      });

      // Create client with service role for auth operations
      const supabase = createSupabaseClient(true);

      // Use the new client instance
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // Add detailed logging of the Supabase response
      console.log('Supabase auth response:', {
        hasAuthData: !!authData,
        hasSession: !!authData?.session,
        hasUser: !!authData?.user,
        error: authError?.message,
        status: authError?.status
      });

      if (authError) throw new Error(authError.message);
      if (!authData?.user || !authData?.session) {
        throw new Error('Invalid authentication response');
      }

      // Get additional user data from public.users if needed
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, preferences, version, last_access')
        .eq('id', authData.user.id)
        .single();

      console.log('User data query result:', {
        hasUserData: !!userData,
        error: userError?.message,
        userFields: userData ? Object.keys(userData) : []
      });

      if (userError || !userData) {
        throw new Error('User data not found');
      }

      // Keep our existing rate limiting
      await this.checkRateLimit(email);

      // Return the response without storing the session
      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          firstName: authData.user.user_metadata.firstName,
          lastName: authData.user.user_metadata.lastName,
          role: userData.role,
          preferences: userData.preferences,
          version: userData.version,
          lastAccess: new Date(userData.last_access)
        },
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token
      };

    } catch (error) {
      console.error('AuthService.login error:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refreshes access token using refresh token
   * @param refreshToken Refresh token
   * @returns New authentication tokens
   */
  public async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = await TokenUtils.verifyRefreshToken(refreshToken);
      
      // Check if refresh token is valid in Redis
      const isValid = await this.validateStoredRefreshToken(decoded.userId, refreshToken);
      if (!isValid) {
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const user = await User.findByEmail(decoded.email);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const [newToken, newRefreshToken] = await Promise.all([
        TokenUtils.generateToken(user),
        TokenUtils.generateRefreshToken(user)
      ]);

      // Rotate refresh token
      await this.rotateRefreshToken(user.id, refreshToken, newRefreshToken);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs out user and invalidates tokens
   * @param token Access token to invalidate
   * @param refreshToken Refresh token to invalidate
   */
  public async logout(token: string, refreshToken: string): Promise<void> {
    try {
      const decoded = await TokenUtils.verifyToken(token);
      
      // Blacklist current tokens
      await Promise.all([
        this.blacklistToken(token, decoded.exp),
        this.removeRefreshToken(decoded.userId, refreshToken)
      ]);
    } catch (error) {
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifies access token validity
   * @param token Access token to verify
   * @returns Decoded token payload
   */
  public async verifyAccessToken(token: string): Promise<any> {
    try {
      // Keep your token blacklist check
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Use Supabase's getUser with error handling
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      if (error) {
        throw new Error(`Token verification failed: ${error.message}`);
      }
      if (!user) {
        throw new Error('No user found for token');
      }

      return user;
    } catch (error) {
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
   * Stores refresh token in Redis
   * @private
   */
  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
    await this.redisClient.set(key, token, {
      EX: 7 * 24 * 60 * 60 // 7 days
    });
  }

  /**
   * Validates stored refresh token
   * @private
   */
  private async validateStoredRefreshToken(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.redisClient.get(`${this.REFRESH_TOKEN_PREFIX}${userId}`);
    return storedToken === token;
  }

  /**
   * Rotates refresh token
   * @private
   */
  private async rotateRefreshToken(userId: string, oldToken: string, newToken: string): Promise<void> {
    const multi = this.redisClient.multi();
    multi.del(`${this.REFRESH_TOKEN_PREFIX}${userId}`);
    multi.set(`${this.REFRESH_TOKEN_PREFIX}${userId}`, newToken, {
      EX: 7 * 24 * 60 * 60
    });
    await multi.exec();
  }

  /**
   * Removes refresh token
   * @private
   */
  private async removeRefreshToken(userId: string, token: string): Promise<void> {
    await this.redisClient.del(`${this.REFRESH_TOKEN_PREFIX}${userId}`);
  }

  /**
   * Blacklists a token
   * @private
   */
  private async blacklistToken(token: string, expiry: number): Promise<void> {
    const key = `${this.TOKEN_BLACKLIST_PREFIX}${token}`;
    const ttl = expiry - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redisClient.set(key, '1', {
        EX: ttl
      });
    }
  }

  /**
   * Checks if token is blacklisted
   * @private
   */
  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const exists = await this.redisClient.exists(`${this.TOKEN_BLACKLIST_PREFIX}${token}`);
    return exists === 1;
  }

  /**
   * Checks rate limiting for authentication attempts
   * @private
   */
  private async checkRateLimit(identifier: string): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${identifier}`;
    const attempts = await this.redisClient.incr(key);
    
    if (attempts === 1) {
      await this.redisClient.expire(key, 60 * 60); // 1 hour window
    }

    if (attempts > RATE_LIMITS.FREE_USER) {
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Sets up periodic cleanup of expired tokens
   * @private
   */
  private setupTokenCleanup(): void {
    setInterval(async () => {
      try {
        const keys = await this.redisClient.keys(`${this.TOKEN_BLACKLIST_PREFIX}*`);
        for (const key of keys) {
          const ttl = await this.redisClient.ttl(key);
          if (ttl <= 0) {
            await this.redisClient.del(key);
          }
        }
      } catch (error) {
        console.error('Token cleanup error:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}
