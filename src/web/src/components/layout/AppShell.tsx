import React, { useState, useLayoutEffect, useCallback } from 'react';
import { cn } from '@/lib/utils'; // v2.3.2
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { Outlet } from 'react-router-dom';

import Header from './Header';
import Sidebar from './Sidebar';
import ContextPanel from './ContextPanel';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../hooks/useAuth';

// Interface for component props
interface AppShellProps {
  className?: string;
}

/**
 * Main application shell component that implements the three-column layout structure
 * with responsive behavior and accessibility support.
 */
const AppShell: React.FC<AppShellProps> = ({ children, className }) => {
  const { isAuthenticated } = useAuth();
  const { 
    responsive: { isMobile, isTablet },
    navigation: { isSidebarOpen, isContextPanelOpen },
    toggleSidebar,
    toggleContextPanel 
  } = useUIStore();

  // Local state for layout transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Handle layout transitions
  useLayoutEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Handle sidebar toggle with touch support
  const handleSidebarToggle = useCallback(() => {
    setIsTransitioning(true);
    toggleSidebar();
  }, [toggleSidebar]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
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

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className={cn(
        'min-h-screen flex flex-col relative overflow-hidden',
        isTransitioning && 'transition-all duration-300 ease-in-out',
        className
      )}>
        <Header
          className="z-50"
          onMenuClick={isMobile ? handleSidebarToggle : undefined}
        />
        <div className="flex flex-1 h-[calc(100vh-64px)] relative">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              'transition-transform duration-300 ease-in-out',
              !isSidebarCollapsed && '-translate-x-full',
              isMobile && 'absolute left-0 top-0 bottom-0 z-40'
            )}
            aria-expanded={!isSidebarCollapsed}
          />
          <main className={cn(
            'flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300',
            'dark:scrollbar-thumb-gray-600 scroll-smooth',
            'p-4 md:p-6',
            isTransitioning && 'transition-all duration-300 ease-in-out',
            'ml-16 md:ml-64',
            isSidebarCollapsed && 'md:ml-16',
            'min-h-[calc(100vh-var(--header-height))]',
            'bg-background dark:bg-gray-900'
          )} role="main">
            {children}
          </main>
        </div>

        {/* Only show context panel if authenticated */}
        {isAuthenticated && (
          <ContextPanel
            className={cn(
              'transition-transform duration-300 ease-in-out',
              (!isContextPanelOpen || isMobile || isTablet) && 'translate-x-full',
              'absolute right-0 top-0 bottom-0 z-30 md:relative'
            )}
            isVisible={isContextPanelOpen}
          />
        )}

        {/* Overlay for mobile sidebar */}
        {isMobile && !isSidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={handleSidebarToggle}
            role="presentation"
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// Display name for debugging
AppShell.displayName = 'AppShell';

export default AppShell;
