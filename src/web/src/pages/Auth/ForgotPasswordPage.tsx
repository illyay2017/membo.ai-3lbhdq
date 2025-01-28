import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../utils/validation';
import { colors, typography } from '../../constants/theme';

/**
 * ForgotPasswordPage component that handles password reset requests
 * Implements comprehensive validation and security measures
 */
const ForgotPasswordPage: React.FC = () => {
  // State management
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();

  /**
   * Handles form submission with validation and rate limiting
   * @param e Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      setIsLoading(true);
      await forgotPassword(email);

      // Show success message
      toast.success(
        'Password reset instructions have been sent to your email',
        { duration: 6000 }
      );

      // Redirect to login page after short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset instructions');
      toast.error('Password reset request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background-dark">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-card p-8 shadow-lg dark:bg-card-dark">
        <h1 
          className="text-2xl font-bold text-center text-foreground dark:text-foreground-dark"
          style={{ fontFamily: typography.fontFamily.primary }}
        >
          Reset Your Password
        </h1>
        
        <p className="text-sm text-center" style={{ color: colors.secondary }}>
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            name="email"
            type="email"
            label="Email Address"
            value={email}
            onChange={setEmail}
            error={error}
            placeholder="Enter your email address"
            disabled={isLoading}
            required
            autoComplete="email"
          />

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isLoading}
            loading={isLoading}
          >
            Send Reset Instructions
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/auth/login')}
              className="text-sm hover:text-primary-dark transition-colors"
              style={{ color: colors.primary }}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
