import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // v6.15.0
import { Analytics } from '@mixpanel/browser'; // v2.45.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import AppShell from './components/layout/AppShell';
import { ROUTES } from './constants/routes';
import { useAuthStore } from './store/authStore';

// Session refresh configuration
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Protected route wrapper component with authentication and loading states
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  LoadingComponent?: React.FC;
}> = React.memo(({ children, LoadingComponent = () => <div>Loading...</div> }) => {
  const { isAuthenticated, sessionError, refreshUserSession } = useAuthStore();
  const location = useLocation();

  // Handle session refresh errors
  useEffect(() => {
    if (sessionError) {
      console.error('Session refresh failed:', sessionError);
    }
  }, [sessionError]);

  // Track protected route access
  useEffect(() => {
    if (isAuthenticated) {
      Analytics.track('Protected Route Access', {
        path: location.pathname,
        timestamp: Date.now()
      });
    }
  }, [location.pathname, isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex items-center justify-center h-screen p-4">
    <div className="text-center">
      <h2 className="text-lg font-semibold text-error mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {error.message}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded-md"
      >
        Refresh Page
      </button>
    </div>
  </div>
);

/**
 * Root application component implementing routing, authentication,
 * and responsive layout structure
 */
const App: React.FC = React.memo(() => {
  const { isAuthenticated, refreshUserSession } = useAuthStore();
  const location = useLocation();

  // Initialize session refresh interval
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    let retryCount = 0;

    const refreshSession = async () => {
      try {
        await refreshUserSession();
        retryCount = 0;
      } catch (error) {
        console.error('Session refresh failed:', error);
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          retryCount++;
          setTimeout(refreshSession, RETRY_DELAY * Math.pow(2, retryCount));
        }
      }
    };

    if (isAuthenticated) {
      refreshInterval = setInterval(refreshSession, SESSION_REFRESH_INTERVAL);
      refreshSession();
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isAuthenticated, refreshUserSession]);

  // Track route changes
  useEffect(() => {
    Analytics.track('Page View', {
      path: location.pathname,
      timestamp: Date.now()
    });
  }, [location.pathname]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppShell>
        <Routes>
          {/* Public routes */}
          <Route path={ROUTES.AUTH.LOGIN} element={<div>Login Page</div>} />
          <Route path={ROUTES.AUTH.REGISTER} element={<div>Register Page</div>} />
          <Route path={ROUTES.AUTH.FORGOT_PASSWORD} element={<div>Forgot Password Page</div>} />
          <Route path={ROUTES.AUTH.RESET_PASSWORD} element={<div>Reset Password Page</div>} />

          {/* Protected routes */}
          <Route
            path={ROUTES.CONTENT.INBOX}
            element={
              <ProtectedRoute>
                <div>Inbox Page</div>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.STUDY.HOME}
            element={
              <ProtectedRoute>
                <div>Study Page</div>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.CARDS.LIST}
            element={
              <ProtectedRoute>
                <div>Cards Page</div>
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.DASHBOARD.HOME}
            element={
              <ProtectedRoute>
                <div>Dashboard Page</div>
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated ? ROUTES.DASHBOARD.HOME : ROUTES.AUTH.LOGIN}
                replace
              />
            }
          />

          {/* 404 fallback */}
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </AppShell>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

/**
 * Root application wrapper with router provider
 */
const AppWrapper: React.FC = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default AppWrapper;