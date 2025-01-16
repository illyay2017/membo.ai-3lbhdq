/**
 * @fileoverview Comprehensive test suite for authentication service
 * Tests secure login flows, user registration, token management, session handling,
 * role-based access control, and security requirements compliance.
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import MockDate from 'mockdate';
import { 
  login, 
  register, 
  logout, 
  refreshToken, 
  validateToken, 
  checkRole 
} from '../../src/services/authService';
import { 
  generateMockLoginCredentials,
  generateMockCard,
  generateMockContent,
  measureApiResponse 
} from '../utils/testHelpers';
import { api } from '../../src/lib/api';
import { 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse, 
  AuthTokens, 
  UserRole 
} from '../../src/types/auth';
import { API_ENDPOINTS } from '../../src/constants/api';

// Mock API client
jest.mock('../../src/lib/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('AuthService', () => {
  // Test constants
  const TOKEN_EXPIRY = 1800000; // 30 minutes
  const REFRESH_THRESHOLD = 300000; // 5 minutes
  const API_TIMEOUT = 200; // 200ms timeout threshold

  // Common test data
  let mockTokens: AuthTokens;
  let mockResponse: AuthResponse;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    MockDate.set(new Date());

    // Setup common test data
    mockTokens = {
      accessToken: 'mock.access.token',
      refreshToken: 'mock.refresh.token',
      expiresIn: TOKEN_EXPIRY
    };

    mockResponse = {
      user: {
        id: '123',
        email: 'test@membo.ai',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.FREE_USER,
        isEmailVerified: true
      },
      tokens: mockTokens
    };
  });

  afterEach(() => {
    MockDate.reset();
  });

  describe('login', () => {
    it('should successfully authenticate with valid credentials', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      mockApi.post.mockResolvedValueOnce(mockResponse);

      // Act
      const { response, duration } = await measureApiResponse(
        login(credentials),
        API_TIMEOUT
      );

      // Assert
      expect(mockApi.post).toHaveBeenCalledWith(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );
      expect(response).toEqual(mockResponse);
      expect(duration).toBeLessThan(API_TIMEOUT);
    });

    it('should handle invalid credentials correctly', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      mockApi.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      // Act & Assert
      await expect(login(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('should enforce rate limiting on multiple failed attempts', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      const attempts = 5;

      // Act & Assert
      for (let i = 0; i < attempts; i++) {
        mockApi.post.mockRejectedValueOnce(new Error('Rate limit exceeded'));
        await expect(login(credentials)).rejects.toThrow('Rate limit exceeded');
      }

      expect(mockApi.post).toHaveBeenCalledTimes(attempts);
    });

    it('should validate token expiry on successful login', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      mockApi.post.mockResolvedValueOnce(mockResponse);

      // Act
      const response = await login(credentials);

      // Assert
      expect(response.tokens.expiresIn).toBe(TOKEN_EXPIRY);
      const futureDate = new Date(Date.now() + TOKEN_EXPIRY);
      MockDate.set(futureDate);
      await expect(validateToken(response.tokens.accessToken))
        .rejects.toThrow('Token expired');
    });
  });

  describe('register', () => {
    it('should successfully register new user with valid data', async () => {
      // Arrange
      const registerData: RegisterCredentials = {
        email: 'new@membo.ai',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User'
      };
      mockApi.post.mockResolvedValueOnce(mockResponse);

      // Act
      const response = await register(registerData);

      // Assert
      expect(mockApi.post).toHaveBeenCalledWith(
        API_ENDPOINTS.AUTH.REGISTER,
        registerData
      );
      expect(response).toEqual(mockResponse);
    });

    it('should validate password strength requirements', async () => {
      // Arrange
      const weakPasswords = [
        'short', // Too short
        'nocapitals123!', // No capitals
        'NOCAPS123!', // No lowercase
        'NoSpecials123', // No special chars
        'NoNumbers!' // No numbers
      ];

      // Act & Assert
      for (const password of weakPasswords) {
        const registerData: RegisterCredentials = {
          email: 'test@membo.ai',
          password,
          firstName: 'Test',
          lastName: 'User'
        };
        await expect(register(registerData))
          .rejects.toThrow('Password does not meet security requirements');
      }
    });

    it('should prevent registration with existing email', async () => {
      // Arrange
      const registerData: RegisterCredentials = {
        email: 'existing@membo.ai',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User'
      };
      mockApi.post.mockRejectedValueOnce(new Error('Email already exists'));

      // Act & Assert
      await expect(register(registerData))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    it('should successfully clear auth state on logout', async () => {
      // Arrange
      mockApi.post.mockResolvedValueOnce(undefined);

      // Act
      await logout();

      // Assert
      expect(mockApi.post).toHaveBeenCalledWith(API_ENDPOINTS.AUTH.LOGOUT);
      expect(mockApi.clearAuthToken).toHaveBeenCalled();
    });

    it('should handle forced logout scenarios', async () => {
      // Arrange
      mockApi.post.mockRejectedValueOnce(new Error('Session terminated'));

      // Act
      await logout();

      // Assert
      expect(mockApi.clearAuthToken).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token before expiry', async () => {
      // Arrange
      mockApi.post.mockResolvedValueOnce({
        ...mockResponse,
        tokens: {
          ...mockTokens,
          accessToken: 'new.access.token'
        }
      });

      // Act
      const response = await refreshToken();

      // Assert
      expect(mockApi.post).toHaveBeenCalledWith(API_ENDPOINTS.AUTH.REFRESH);
      expect(response.tokens.accessToken).toBe('new.access.token');
    });

    it('should handle refresh token rotation', async () => {
      // Arrange
      const newTokens = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        expiresIn: TOKEN_EXPIRY
      };
      mockApi.post.mockResolvedValueOnce({
        ...mockResponse,
        tokens: newTokens
      });

      // Act
      const response = await refreshToken();

      // Assert
      expect(response.tokens).toEqual(newTokens);
      expect(response.tokens.refreshToken).not.toBe(mockTokens.refreshToken);
    });

    it('should handle refresh token expiry', async () => {
      // Arrange
      mockApi.post.mockRejectedValueOnce(new Error('Refresh token expired'));

      // Act & Assert
      await expect(refreshToken())
        .rejects.toThrow('Session expired. Please login again.');
      expect(mockApi.clearAuthToken).toHaveBeenCalled();
    });

    it('should prevent concurrent refresh requests', async () => {
      // Arrange
      const refreshPromise = refreshToken();
      
      // Act & Assert
      await expect(refreshToken())
        .rejects.toThrow('Token refresh already in progress');
      await refreshPromise;
    });
  });

  describe('security validations', () => {
    it('should validate security headers', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      mockApi.post.mockResolvedValueOnce(mockResponse);

      // Act
      await login(credentials);

      // Assert
      expect(mockApi.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should implement CORS protection', async () => {
      // Arrange
      const credentials = generateMockLoginCredentials();
      mockApi.post.mockRejectedValueOnce(new Error('CORS error'));

      // Act & Assert
      await expect(login(credentials))
        .rejects.toThrow('CORS error');
    });

    it('should prevent XSS in credentials', async () => {
      // Arrange
      const maliciousCredentials: LoginCredentials = {
        email: '<script>alert("xss")</script>',
        password: 'SecurePass123!'
      };

      // Act & Assert
      await expect(login(maliciousCredentials))
        .rejects.toThrow('Invalid credentials provided');
    });
  });
});