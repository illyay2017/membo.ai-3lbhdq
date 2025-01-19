import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'; // v6.15.0
import mixpanel from "mixpanel-browser";
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import AppShell from './components/layout/AppShell';
import { ROUTES } from './constants/routes';
import { useAuthStore } from './store/authStore';
import { wsService } from './services/websocketService';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';

// Session refresh configuration
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Initialize mixpanel at the top of the file
mixpanel.init("YOUR_PROJECT_TOKEN");

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
      mixpanel.track('Protected Route Access', {
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
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Check if current route is an auth route
  const isAuthRoute = location.pathname.startsWith('/auth');
  
  // Redirect to login if not authenticated and not on an auth route
  if (!isAuthenticated && !isAuthRoute && location.pathname !== '/') {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {isAuthRoute ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-md p-8">
            <Outlet />
          </div>
        </div>
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </ErrorBoundary>
  );
});

App.displayName = 'App';

// Simple index route component
const IndexRoute = () => <Navigate to={ROUTES.AUTH.LOGIN} replace />;

// Create router with routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorFallback error={new Error('Page not found')} />,
    children: [
      {
        index: true,
        element: <IndexRoute />
      },
      // Auth routes
      {
        path: ROUTES.AUTH.LOGIN,
        element: <LoginPage />
      },
      {
        path: ROUTES.AUTH.REGISTER,
        element: <RegisterPage />
      },
      {
        path: ROUTES.AUTH.FORGOT_PASSWORD,
        element: <ForgotPasswordPage />
      },
      // Protected routes
      {
        path: ROUTES.CONTENT.INBOX,
        element: (
          <ProtectedRoute>
            <div>Inbox Page</div>
          </ProtectedRoute>
        )
      },
      {
        path: ROUTES.STUDY.HOME,
        element: (
          <ProtectedRoute>
            <div>Study Page</div>
          </ProtectedRoute>
        )
      },
      {
        path: ROUTES.CARDS.LIST,
        element: (
          <ProtectedRoute>
            <div>Cards Page</div>
          </ProtectedRoute>
        )
      },
      {
        path: ROUTES.DASHBOARD.HOME,
        element: (
          <ProtectedRoute>
            <div>Dashboard Page</div>
          </ProtectedRoute>
        )
      }
    ]
  }
]);

/**
 * Root application wrapper with router provider
 */
const AppWrapper: React.FC = () => {
  console.log('AppWrapper mounting');
  return <RouterProvider router={router} />;
};

export default AppWrapper;
