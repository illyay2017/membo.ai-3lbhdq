import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { validateRegistrationData } from '../../utils/validation';
import { UserRole } from '@shared/types/userRoles';
import { colors, typography } from '../../constants/theme';

// Near the top of the file, get the site key from env
console.log('RECAPTCHA_SITE_KEY:', import.meta.env.VITE_RECAPTCHA_SITE_KEY);

// Registration form data interface
interface RegisterFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  captchaToken?: string;
  deviceFingerprint?: string;
}

// Rate limiting configuration
const RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 300000, // 5 minutes
  blockDuration: 900000 // 15 minutes
};

// Near the top of the file
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

/**
 * Enhanced registration page component with security features
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuth();

  // Initialize form with validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
    watch,
    setValue
  } = useForm<RegisterFormData>({
    mode: 'onBlur',
    defaultValues: {
      role: UserRole.FREE_USER,
      deviceFingerprint: '',
      captchaToken: ''
    }
  });

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    };

    generateFingerprint().catch(console.error);
  }, []);

  // Update the reCAPTCHA effect
  useEffect(() => {
    const loadRecaptcha = async () => {
      if (!window.grecaptcha) {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        script.defer = true;
        
        const scriptPromise = new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });

        document.head.appendChild(script);
        await scriptPromise;
      }

      await window.grecaptcha.ready(() => {
        console.log('reCAPTCHA is ready');
      });
    };

    loadRecaptcha().catch(console.error);

    return () => {
      // Clean up script if component unmounts
      const script = document.querySelector(`script[src*="recaptcha"]`);
      if (script) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Handle form submission with security checks
  const onSubmit = useCallback(async (data: RegisterFormData) => {
    try {
      console.log('Starting registration submission...');
      
      let token;
      try {
        token = await window.grecaptcha?.execute(RECAPTCHA_SITE_KEY, {
          action: 'register'
        });
        console.log('reCAPTCHA token obtained:', token ? 'Present' : 'Missing');
      } catch (error) {
        console.error('reCAPTCHA error:', error);
        if (process.env.NODE_ENV === 'development') {
          console.warn('Continuing without reCAPTCHA in development');
        } else {
          throw new Error('Failed to verify reCAPTCHA. Please try again.');
        }
      }

      const registrationData = {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        ...(token && { captchaToken: token })
      };

      console.log('Submitting registration data...', {
        ...registrationData,
        password: '[REDACTED]'
      });

      const result = await registerUser(registrationData);
      
      console.log('Registration result:', {
        success: !!result,
        hasUser: result?.user ? 'Yes' : 'No',
        hasToken: result?.token ? 'Yes' : 'No',
        hasTokens: result?.tokens ? 'Yes' : 'No'
      });

      if (!result?.user || (!result?.token && !result?.tokens)) {
        throw new Error('Invalid registration response');
      }

      // Navigate only if we have valid data
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      setError('root', {
        message: error instanceof Error 
          ? error.message 
          : 'Registration failed. Please try again.'
      });
    }
  }, [registerUser, navigate, setError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: typography.fontFamily.primary }}>
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/auth/login" className="font-medium text-primary hover:text-primary/90" style={{ color: colors.primary }}>
              Sign in
            </a>
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Input
              id="firstName"
              label="First Name"
              error={errors.firstName?.message}
              {...register('firstName', {
                required: 'First name is required',
                minLength: { value: 2, message: 'First name is too short' },
                maxLength: { value: 50, message: 'First name is too long' },
                pattern: {
                  value: /^[a-zA-Z\s-']+$/,
                  message: 'First name contains invalid characters'
                }
              })}
            />

            <Input
              id="lastName"
              label="Last Name"
              error={errors.lastName?.message}
              {...register('lastName', {
                required: 'Last name is required',
                minLength: { value: 2, message: 'Last name is too short' },
                maxLength: { value: 50, message: 'Last name is too long' },
                pattern: {
                  value: /^[a-zA-Z\s-']+$/,
                  message: 'Last name contains invalid characters'
                }
              })}
            />
          </div>

          {/* Email Field */}
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
          />

          {/* Password Field */}
          <Input
            id="password"
            type="password"
            label="Password"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                message: 'Password must contain uppercase, lowercase, number and special character'
              }
            })}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            loading={isLoading}
          >
            Create Account
          </Button>

          {/* General Error Message */}
          {errors.root && (
            <p className="text-sm text-red-500 text-center mt-2">{errors.root.message}</p>
          )}
        </form>

        {/* Terms and Privacy */}
        <p className="mt-4 text-xs text-center text-gray-600">
          By creating an account, you agree to our{' '}
          <a href="/terms" className="font-medium text-primary hover:text-primary/90">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="font-medium text-primary hover:text-primary/90">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
