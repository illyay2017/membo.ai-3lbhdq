import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { validatePassword } from '../../utils/validation';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ResetPasswordFormData>();

  const onSubmit = useCallback(async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!token) {
        throw new Error('Invalid reset token');
      }

      await resetPassword({
        token,
        newPassword: data.password
      });

      navigate('/auth/login', { 
        replace: true,
        state: { message: 'Password reset successful. Please login with your new password.' }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  }, [token, resetPassword, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Reset Password</h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input
            type="password"
            label="New Password"
            {...register('password', {
              required: 'Password is required',
              validate: validatePassword
            })}
            error={errors.password?.message}
          />

          <Input
            type="password"
            label="Confirm Password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: value => value === watch('password') || 'Passwords do not match'
            })}
            error={errors.confirmPassword?.message}
          />

          {error && (
            <div className="text-sm text-red-500 text-center" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage; 