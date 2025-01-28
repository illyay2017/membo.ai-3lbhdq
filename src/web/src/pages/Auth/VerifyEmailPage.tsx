import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';

const VerifyEmailPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        if (!token) throw new Error('Invalid verification token');
        await verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verify();
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
        {status === 'loading' && (
          <div className="animate-pulse">Verifying your email...</div>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-green-600 mb-4">
              Email Verified Successfully!
            </h1>
            <p className="text-gray-600 mb-6">
              Thank you for verifying your email address. You can now access all features of membo.ai
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Verification Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {error || 'Unable to verify your email. Please try again or contact support.'}
            </p>
            <Button
              onClick={() => navigate('/auth/login')}
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
