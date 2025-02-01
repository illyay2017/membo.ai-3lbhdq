import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // v6.15.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useAuth } from './hooks/useAuth';
import { analytics } from './lib/analytics';

import AppShell from './components/layout/AppShell';
import { ROUTES } from './constants/routes';
import { useAuthStore } from './store/authStore';
import ErrorComponent from './components/ErrorComponent';

// Import actual page components
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';
import VerifyEmailPage from './pages/Auth/VerifyEmailPage';
import InboxPage from './pages/Content/InboxPage';
import StudyPage from './pages/Study/StudyPage';
import CardsPage from './pages/Cards/CardsPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import SettingsPage from './pages/Settings/SettingsPage';
import { useUIStore } from './store/uiStore';

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
  const { isAuthenticated, user, sessionError, refreshUserSession } = useAuthStore();
  const location = useLocation();
  const analyticsEnabled = !!import.meta.env.VITE_MIXPANEL_TOKEN;

  console.log('ProtectedRoute: Checking auth state:', {
    isAuthenticated,
    hasUser: !!user,
    currentPath: location.pathname,
    sessionError
  });

  // Handle session refresh errors
  useEffect(() => {
    if (sessionError) {
      console.error('Session refresh failed:', sessionError);
    }
  }, [sessionError]);

  // Track protected route access using analytics wrapper
  useEffect(() => {
    if (isAuthenticated && analyticsEnabled) {
      analytics.trackCardInteraction({
        type: 'route_access',
        path: location.pathname,
        timestamp: Date.now()
      });
    }
  }, [location.pathname, isAuthenticated, analyticsEnabled]);

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Redirecting to login');
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
  const { isLoading, isAuthenticated } = useAuth();
  const { initializeAuth } = useAuthStore();
  const location = useLocation();
  const analyticsEnabled = !!import.meta.env.VITE_MIXPANEL_TOKEN;

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (useUIStore.getState().theme.mode === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (isLoading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Routes>
        {/* Public routes */}
        <Route path={ROUTES.AUTH.LOGIN} element={
          isAuthenticated ? <Navigate to={ROUTES.DASHBOARD.HOME} replace /> : <LoginPage />
        } />
        <Route path={ROUTES.AUTH.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.AUTH.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.AUTH.RESET_PASSWORD} element={<ResetPasswordPage />} />
        <Route path={ROUTES.AUTH.VERIFY_EMAIL} element={<VerifyEmailPage />} />

        {/* Protected routes */}
        <Route element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route path={ROUTES.DASHBOARD.HOME} element={<DashboardPage />} />
          <Route path={ROUTES.CONTENT.INBOX} element={<InboxPage />} />
          <Route path={ROUTES.STUDY.HOME} element={<StudyPage />} />
          <Route path={ROUTES.CARDS.LIST} element={<CardsPage />} />
          <Route path={ROUTES.SETTINGS.HOME} element={<SettingsPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={
          <Navigate to={isAuthenticated ? ROUTES.DASHBOARD.HOME : ROUTES.AUTH.LOGIN} replace />
        } />
        
        <Route path="*" element={<ErrorComponent />} />
      </Routes>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

/**
 * Root application wrapper with router provider
 */
const AppWrapper: React.FC = () => (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}
  >
    <App />
  </BrowserRouter>
);

export default AppWrapper;
