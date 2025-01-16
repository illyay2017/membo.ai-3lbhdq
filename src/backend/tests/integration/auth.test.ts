/**
 * @fileoverview Integration tests for authentication flows including user registration,
 * login, token refresh, and logout operations with comprehensive security validation.
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import supertest from 'supertest'; // v6.3.3
import jsonwebtoken from 'jsonwebtoken'; // v9.0.0
import { AuthService } from '../../src/services/AuthService';
import { createMockUser, setupTestDatabase } from '../utils/testHelpers';
import { ErrorCodes } from '../../src/constants/errorCodes';

// Test constants
const TEST_USER_EMAIL = 'test@membo.ai';
const TEST_USER_PASSWORD = 'TestPass123!';
const TOKEN_EXPIRY_TIME = 1800000; // 30 minutes
const RATE_LIMIT_WINDOW = 900000; // 15 minutes

let authService: AuthService;

/**
 * Setup test environment before all tests
 */
beforeAll(async () => {
  await setupTestDatabase();
  authService = new AuthService();
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  await authService['redisClient'].quit();
});

/**
 * Reset test state before each test
 */
beforeEach(async () => {
  // Clear rate limiting and token data
  await authService['redisClient'].flushall();
});

describe('User Registration', () => {
  it('should successfully register a new user', async () => {
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const response = await authService.register({
      email: mockUser.email,
      password: mockUser.password,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName
    });

    // Verify response structure
    expect(response).toHaveProperty('user');
    expect(response).toHaveProperty('token');
    expect(response).toHaveProperty('refreshToken');

    // Verify user data
    expect(response.user.email).toBe(mockUser.email.toLowerCase());
    expect(response.user.isEmailVerified).toBe(false);

    // Verify token format and expiry
    const decodedToken = jsonwebtoken.decode(response.token) as any;
    expect(decodedToken).toBeTruthy();
    expect(decodedToken.exp - decodedToken.iat).toBe(TOKEN_EXPIRY_TIME / 1000);
  });

  it('should enforce password strength requirements', async () => {
    const weakPasswords = [
      'short', // Too short
      'nouppercaseornumber', // Missing uppercase and number
      'NOLOWERCASEORNUMBER', // Missing lowercase and number
      'NoSpecialChar123', // Missing special character
      'Common123!' // Common password pattern
    ];

    for (const password of weakPasswords) {
      try {
        await authService.register({
          email: TEST_USER_EMAIL,
          password,
          firstName: 'Test',
          lastName: 'User'
        });
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Password');
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    }
  });

  it('should handle rate limiting', async () => {
    const attempts = 101; // Exceeds FREE_USER rate limit
    const mockUser = createMockUser();

    for (let i = 0; i < attempts; i++) {
      try {
        await authService.register({
          email: `test${i}@membo.ai`,
          password: TEST_USER_PASSWORD,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        });
      } catch (error: any) {
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
        break;
      }
    }
  });
});

describe('User Login', () => {
  it('should successfully login existing user', async () => {
    // Register test user first
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    await authService.register(mockUser);

    // Attempt login
    const response = await authService.login(TEST_USER_EMAIL, TEST_USER_PASSWORD);

    // Verify response
    expect(response).toHaveProperty('user');
    expect(response).toHaveProperty('token');
    expect(response).toHaveProperty('refreshToken');

    // Verify token security
    const decodedToken = jsonwebtoken.decode(response.token) as any;
    expect(decodedToken.userId).toBeTruthy();
    expect(decodedToken.iss).toBe('membo.ai');
    expect(decodedToken.aud).toBe('membo.ai/api');
  });

  it('should implement brute force protection', async () => {
    const maxAttempts = 5;
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    await authService.register(mockUser);

    // Attempt multiple failed logins
    for (let i = 0; i < maxAttempts + 1; i++) {
      try {
        await authService.login(TEST_USER_EMAIL, 'wrongpassword');
      } catch (error: any) {
        if (i >= maxAttempts) {
          expect(error.message).toContain('Account is temporarily locked');
          break;
        }
      }
    }

    // Verify lockout duration
    try {
      await authService.login(TEST_USER_EMAIL, TEST_USER_PASSWORD);
      fail('Should be locked out');
    } catch (error: any) {
      expect(error.message).toContain('Account is temporarily locked');
    }
  });
});

describe('Token Refresh', () => {
  it('should implement secure token rotation', async () => {
    // Login to get initial tokens
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    const { refreshToken: originalRefreshToken } = await authService.register(mockUser);

    // Perform token refresh
    const { token: newToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(originalRefreshToken);

    // Verify new tokens
    expect(newToken).toBeTruthy();
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(originalRefreshToken);

    // Verify old refresh token is invalidated
    try {
      await authService.refreshAccessToken(originalRefreshToken);
      fail('Should not allow reuse of old refresh token');
    } catch (error: any) {
      expect(error.message).toContain('Invalid refresh token');
    }
  });

  it('should prevent refresh token reuse', async () => {
    // Login and get refresh token
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    const { refreshToken } = await authService.register(mockUser);

    // Use refresh token once
    await authService.refreshAccessToken(refreshToken);

    // Attempt to reuse the same refresh token
    try {
      await authService.refreshAccessToken(refreshToken);
      fail('Should not allow refresh token reuse');
    } catch (error: any) {
      expect(error.message).toContain('Invalid refresh token');
    }
  });
});

describe('User Logout', () => {
  it('should implement secure logout', async () => {
    // Login to get tokens
    const mockUser = createMockUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    const { token, refreshToken } = await authService.register(mockUser);

    // Perform logout
    await authService.logout(token, refreshToken);

    // Verify token is blacklisted
    try {
      await authService.verifyAccessToken(token);
      fail('Should not allow use of logged out token');
    } catch (error: any) {
      expect(error.message).toContain('Token has been revoked');
    }

    // Verify refresh token is invalidated
    try {
      await authService.refreshAccessToken(refreshToken);
      fail('Should not allow use of logged out refresh token');
    } catch (error: any) {
      expect(error.message).toContain('Invalid refresh token');
    }
  });
});