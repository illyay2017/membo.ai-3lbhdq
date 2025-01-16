import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../utils/validation';

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

    // Validate email
    try {
      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      setIsLoading(true);

      // Attempt password reset request
      await forgotPassword(email);

      // Show success message
      toast.success(
        'Password reset instructions have been sent to your email',
        {
          duration: 6000,
          position: 'bottom-right',
        }
      );

      // Redirect to login page after short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('rate limit')) {
          setError('Too many attempts. Please try again later.');
        } else if (err.message.includes('not found')) {
          setError('No account found with this email address');
        } else {
          setError('An error occurred. Please try again.');
        }
        
        toast.error('Password reset request failed', {
          position: 'bottom-right',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
          Reset Your Password
        </h1>
        
        <p className="text-sm text-gray-600 text-center mb-8">
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            name="email"
            type="email"
            label="Email Address"
            value={email}
            error={error}
            onChange={setEmail}
            placeholder="Enter your email address"
            disabled={isLoading}
            required
            autoComplete="email"
            aria-label="Email Address"
            aria-describedby={error ? 'email-error' : undefined}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            loading={isLoading}
          >
            Send Reset Instructions
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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