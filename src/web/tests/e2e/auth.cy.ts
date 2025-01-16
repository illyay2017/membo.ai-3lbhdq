import { generateMockLoginCredentials } from '../utils/testHelpers';
import { LoginCredentials, RegisterCredentials } from '../../src/types/auth';
import { UserRole } from '../../backend/src/constants/userRoles';

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/auth/login').as('loginRequest');
    cy.intercept('POST', '/api/v1/auth/register').as('registerRequest');
    cy.intercept('POST', '/api/v1/auth/refresh-token').as('refreshToken');
    cy.visit('/auth/login');
  });

  afterEach(() => {
    cy.clearCookies();
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', () => {
      const credentials = generateMockLoginCredentials();

      cy.get('[data-testid="email-input"]').type(credentials.email);
      cy.get('[data-testid="password-input"]').type(credentials.password);
      cy.get('[data-testid="login-button"]').click();

      cy.wait('@loginRequest').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('tokens');
        expect(interception.response?.body.tokens).to.have.property('accessToken');
      });

      // Verify JWT token storage
      cy.window().its('localStorage')
        .invoke('getItem', 'accessToken')
        .should('exist');

      cy.url().should('include', '/dashboard');
    });

    it('should handle invalid credentials correctly', () => {
      const invalidCredentials: LoginCredentials = {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      };

      cy.get('[data-testid="email-input"]').type(invalidCredentials.email);
      cy.get('[data-testid="password-input"]').type(invalidCredentials.password);
      cy.get('[data-testid="login-button"]').click();

      cy.wait('@loginRequest');
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Invalid email or password');
    });

    it('should enforce rate limiting on failed attempts', () => {
      const invalidCredentials = generateMockLoginCredentials();
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        cy.get('[data-testid="email-input"]').clear().type(invalidCredentials.email);
        cy.get('[data-testid="password-input"]').clear().type(invalidCredentials.password);
        cy.get('[data-testid="login-button"]').click();
        cy.wait('@loginRequest');
      }

      cy.get('[data-testid="error-message"]')
        .should('contain', 'Too many login attempts');
    });

    it('should maintain session across page reloads', () => {
      const credentials = generateMockLoginCredentials();

      // Login
      cy.get('[data-testid="email-input"]').type(credentials.email);
      cy.get('[data-testid="password-input"]').type(credentials.password);
      cy.get('[data-testid="login-button"]').click();
      cy.wait('@loginRequest');

      // Reload page
      cy.reload();

      // Verify session persistence
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });
  });

  describe('Registration Flow', () => {
    beforeEach(() => {
      cy.visit('/auth/register');
    });

    it('should successfully register new user', () => {
      const registerData: RegisterCredentials = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      cy.get('[data-testid="firstName-input"]').type(registerData.firstName);
      cy.get('[data-testid="lastName-input"]').type(registerData.lastName);
      cy.get('[data-testid="email-input"]').type(registerData.email);
      cy.get('[data-testid="password-input"]').type(registerData.password);
      cy.get('[data-testid="register-button"]').click();

      cy.wait('@registerRequest').then((interception) => {
        expect(interception.response?.statusCode).to.equal(201);
        expect(interception.response?.body.user.role).to.equal(UserRole.FREE_USER);
      });

      // Verify email verification screen
      cy.url().should('include', '/auth/verify-email');
    });

    it('should validate password requirements', () => {
      const weakPasswords = ['short', 'nospecial123', 'NoNumbers!', '12345678!'];

      weakPasswords.forEach(password => {
        cy.get('[data-testid="password-input"]').clear().type(password);
        cy.get('[data-testid="password-strength"]')
          .should('be.visible')
          .and('contain', 'Password is too weak');
      });
    });

    it('should prevent duplicate email registration', () => {
      const existingEmail = 'existing@example.com';

      cy.get('[data-testid="firstName-input"]').type('John');
      cy.get('[data-testid="lastName-input"]').type('Doe');
      cy.get('[data-testid="email-input"]').type(existingEmail);
      cy.get('[data-testid="password-input"]').type('SecurePass123!');
      cy.get('[data-testid="register-button"]').click();

      cy.get('[data-testid="error-message"]')
        .should('contain', 'Email already registered');
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(() => {
      cy.visit('/auth/forgot-password');
    });

    it('should handle forgot password request', () => {
      const email = 'test@example.com';

      cy.get('[data-testid="email-input"]').type(email);
      cy.get('[data-testid="reset-button"]').click();

      cy.get('[data-testid="success-message"]')
        .should('contain', 'Password reset instructions sent');
    });

    it('should validate reset token', () => {
      // Simulate expired token
      cy.visit('/auth/reset-password?token=expired_token');

      cy.get('[data-testid="error-message"]')
        .should('contain', 'Reset token has expired');
    });

    it('should enforce password requirements on reset', () => {
      cy.visit('/auth/reset-password?token=valid_token');

      const newPassword = 'WeakPass';
      cy.get('[data-testid="new-password"]').type(newPassword);
      cy.get('[data-testid="confirm-password"]').type(newPassword);
      cy.get('[data-testid="submit-button"]').click();

      cy.get('[data-testid="password-requirements"]')
        .should('contain', 'Must contain at least one special character');
    });
  });

  describe('Session Management', () => {
    it('should handle token refresh', () => {
      const credentials = generateMockLoginCredentials();

      // Login and get initial token
      cy.get('[data-testid="email-input"]').type(credentials.email);
      cy.get('[data-testid="password-input"]').type(credentials.password);
      cy.get('[data-testid="login-button"]').click();
      cy.wait('@loginRequest');

      // Wait for token refresh
      cy.clock().tick(25 * 60 * 1000); // 25 minutes
      cy.wait('@refreshToken').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('accessToken');
      });
    });

    it('should handle session timeout', () => {
      const credentials = generateMockLoginCredentials();

      // Login
      cy.get('[data-testid="email-input"]').type(credentials.email);
      cy.get('[data-testid="password-input"]').type(credentials.password);
      cy.get('[data-testid="login-button"]').click();
      cy.wait('@loginRequest');

      // Simulate 30 minutes inactivity
      cy.clock().tick(31 * 60 * 1000);

      // Verify redirect to login
      cy.url().should('include', '/auth/login');
      cy.get('[data-testid="session-expired"]')
        .should('contain', 'Session expired');
    });

    it('should properly clear session on logout', () => {
      const credentials = generateMockLoginCredentials();

      // Login
      cy.get('[data-testid="email-input"]').type(credentials.email);
      cy.get('[data-testid="password-input"]').type(credentials.password);
      cy.get('[data-testid="login-button"]').click();
      cy.wait('@loginRequest');

      // Logout
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      // Verify session cleared
      cy.window().then((win) => {
        expect(win.localStorage.getItem('accessToken')).to.be.null;
        expect(win.localStorage.getItem('refreshToken')).to.be.null;
      });

      cy.url().should('include', '/auth/login');
    });
  });
});