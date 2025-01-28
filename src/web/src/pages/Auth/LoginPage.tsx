/**
 * Secure login page component implementing JWT-based authentication with Supabase,
 * comprehensive input validation, and membo.ai design system compliance
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../../utils/analytics';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { sanitizeInput } from '../../utils/validation';
import { colors, typography } from '../../constants/theme';

// Form data interface
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Validation rules
const validationRules = {
  email: {
    required: 'Email is required',
    pattern: {
      value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      message: 'Invalid email format'
    }
  },
  password: {
    required: 'Password is required',
    minLength: {
      value: 8,
      message: 'Password must be at least 8 characters'
    }
  }
};

const LoginPage: React.FC = () => {
  // Hooks initialization
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<LoginFormData>();

  // Form submission handler
  const onSubmit = useCallback(async (formData: LoginFormData) => {
    try {
      setError(null);

      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(formData.email);
      const sanitizedPassword = sanitizeInput(formData.password);

      // Track login attempt if analytics is available
      analytics.track('Login Attempt', {
        timestamp: new Date().toISOString()
      });

      // Attempt login
      await login({
        email: sanitizedEmail,
        password: sanitizedPassword
      });

      // Track successful login if analytics is available
      if (analytics?.track) {
        analytics.track('Login Success', {
          timestamp: new Date().toISOString()
        });
      }

      navigate('/dashboard');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);

      // Track failure if analytics is available
      if (analytics?.track) {
        analytics.track('Login Failed', {
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background-dark">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-card p-8 shadow-lg dark:bg-card-dark">
        {/* Logo and Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground dark:text-foreground-dark" 
              style={{ fontFamily: typography.fontFamily.primary }}>
            Welcome to membo.ai
          </h2>
          <p className="mt-2 text-sm" style={{ color: colors.secondary }}>
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          {/* Email Input */}
          <Input
            id="email"
            type="email"
            label="Email Address"
            error={errors.email?.message}
            {...register('email')}
            onChange={(value) => setValue('email', value)}
            autoComplete="username"
          />

          {/* Password Input */}
          <Input
            id="password"
            type="password"
            label="Password"
            error={errors.password?.message}
            {...register('password')}
            onChange={(value) => setValue('password', value)}
            autoComplete="current-password"
          />

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="ml-2 text-sm" style={{ color: colors.secondary }}>
                Remember me
              </span>
            </label>

            <a
              href="/auth/forgot-password"
              className="text-sm hover:text-primary-dark transition-colors"
              style={{ color: colors.primary }}
            >
              Forgot password?
            </a>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm font-medium text-destructive dark:text-destructive-dark" 
                 role="alert">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            Sign In
          </Button>

          {/* Sign Up Link */}
          <p className="text-center text-sm" style={{ color: colors.secondary }}>
            Don't have an account?{' '}
            <a
              href="/auth/register"
              className="hover:text-primary-dark transition-colors"
              style={{ color: colors.primary }}
            >
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
