/**
 * @fileoverview Token management service implementing secure token generation,
 * validation, and lifecycle management using existing JWT utilities.
 * @version 1.0.0
 */

import { IUser } from '../interfaces/IUser';
import * as TokenUtils from '../utils/jwt';
import { JWTError } from '../utils/jwt';
import { RedisService } from '../services/RedisService';

export class TokenService {
  private readonly TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';
  private readonly REFRESH_TOKEN_PREFIX = 'refresh:token:';
  private readonly SESSION_PREFIX = 'session:';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generates a new token pair (access + refresh) for a user
   */
  async generateTokenPair(user: IUser): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      TokenUtils.generateToken(user),
      TokenUtils.generateRefreshToken(user)
    ]);

    const decoded = await TokenUtils.verifyRefreshToken(refreshToken);
    await this.storeRefreshToken(user.id, decoded.jti, refreshToken);

    return { accessToken, refreshToken };
  }

  /**
   * Verifies an access token and checks blacklist
   * @param token Access token to verify
   * @returns Decoded token payload
   * @throws {JWTError} If token is invalid or blacklisted
   */
  async verifyAccessToken(token: string) {
    const decoded = await TokenUtils.verifyToken(token);
    if (await this.isTokenBlacklisted(decoded.jti)) {
      throw new JWTError('Token has been revoked', 'TOKEN_REVOKED');
    }
    return decoded;
  }

  /**
   * Verifies a refresh token and ensures it's valid in storage
   */
  async verifyRefreshToken(refreshToken: string) {
    const decoded = await TokenUtils.verifyRefreshToken(refreshToken);
    if (!await this.validateStoredRefreshToken(decoded.userId, decoded.jti)) {
      throw new JWTError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    return decoded;
  }

  /**
   * Invalidates both access and refresh tokens
   */
  async invalidateTokens(accessToken: string, refreshToken: string) {
    try {
      const [accessDecoded, refreshDecoded] = await Promise.all([
        TokenUtils.verifyToken(accessToken),
        TokenUtils.verifyRefreshToken(refreshToken)
      ]);

      await Promise.all([
        this.blacklistToken(accessDecoded.jti, accessDecoded.exp),
        this.removeRefreshToken(refreshDecoded.userId, refreshDecoded.jti)
      ]);
    } catch (error) {
      throw new JWTError(
        `Token invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TOKEN_INVALIDATION_ERROR'
      );
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    const decoded = await this.verifyRefreshToken(refreshToken);
    const isValid = await this.validateStoredRefreshToken(decoded.userId, refreshToken);
    
    if (!isValid) {
      throw new JWTError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const tokens = await this.generateTokenPair(decoded as IUser);
    
    await this.rotateRefreshToken(decoded.userId, refreshToken, tokens.refreshToken);
    
    return { token: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async invalidateSession(userId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${userId}`;
    const tokenPattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
    
    // Get all refresh tokens for user
    const keys = await this.redisService.keys(tokenPattern);
    
    const multi = this.redisService.multi();
    // Remove all refresh tokens
    keys.forEach(key => multi.del(key));
    // Remove session
    multi.del(sessionKey);
    
    await multi.exec();
  }

  private async storeRefreshToken(userId: string, tokenId: string, token: string) {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    await this.redisService.set(key, token, 7 * 24 * 60 * 60); // 7 days
  }

  private async validateStoredRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    const storedToken = await this.redisService.get(key);
    return !!storedToken;
  }

  private async removeRefreshToken(userId: string, tokenId: string) {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    await this.redisService.del(key);
  }

  private async rotateRefreshToken(userId: string, oldToken: string, newToken: string) {
    const multi = await this.redisService.multi();
    const oldTokenData = await this.verifyRefreshToken(oldToken);
    const newTokenData = await this.verifyRefreshToken(newToken);
    
    multi.del(`${this.REFRESH_TOKEN_PREFIX}${userId}:${oldTokenData.jti}`);
    multi.set(
      `${this.REFRESH_TOKEN_PREFIX}${userId}:${newTokenData.jti}`,
      newToken,
      'EX',
      7 * 24 * 60 * 60
    );
    
    await multi.exec();
  }

  private async blacklistToken(tokenId: string, expiry: number) {
    const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
    const ttl = expiry - Math.floor(Date.now() / 1000);
    
    if (ttl > 0) {
      await this.redisService.set(key, '1', ttl);
    }
  }

  private async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const key = `${this.TOKEN_BLACKLIST_PREFIX}${tokenId}`;
    return !!(await this.redisService.get(key));
  }

  private setupTokenCleanup(): void {
    setInterval(async () => {
      try {
        const keys = await this.redisService.keys(`${this.TOKEN_BLACKLIST_PREFIX}*`);
        for (const key of keys) {
          const ttl = await this.redisService.ttl(key);
          if (ttl <= 0) {
            await this.redisService.del(key);
          }
        }
      } catch (error) {
        console.error('Token cleanup error:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}
