/**
 * Secure login page component implementing JWT-based authentication with Supabase,
 * comprehensive input validation, and membo.ai design system compliance
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { analytics } from '../../utils/analytics';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { sanitizeInput } from '../../utils/validation';
import { colors, typography } from '../../constants/theme';
import { ROUTES } from '../../constants/routes';

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
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      setError(null);
      console.log('Starting login process...');

      const sanitizedEmail = sanitizeInput(data.email);
      const sanitizedPassword = sanitizeInput(data.password);

      analytics.track('Login Attempt', {
        timestamp: new Date().toISOString()
      });

      console.log('Calling login function...');
      await login({
        email: sanitizedEmail,
        password: sanitizedPassword
      });
      console.log('Login successful, attempting navigation...');

      analytics.track('Login Success', {
        timestamp: new Date().toISOString()
      });

      navigate(ROUTES.DASHBOARD.HOME, { replace: true });
      console.log('Navigation called to:', ROUTES.DASHBOARD.HOME);
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
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
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address'
              }
            })}
            onChange={(value) => setValue('email', value)}
            autoComplete="username"
          />

          {/* Password Input */}
          <Input
            id="password"
            type="password"
            label="Password"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters'
              }
            })}
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
            <Link
              to={ROUTES.AUTH.REGISTER}
              className="hover:text-primary-dark transition-colors"
              style={{ color: colors.primary }}
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
