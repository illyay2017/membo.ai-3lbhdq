/**
 * Primary navigation component for membo.ai web application
 * Implements responsive design with mobile support and authentication integration
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom'; // v6.0.0
import { 
  InboxIcon, 
  BookOpenIcon, 
  LayersIcon, 
  SettingsIcon, 
  LogOutIcon,
  MenuIcon,
  BellIcon,
  UserIcon
} from 'lucide-react'; // v0.284.0

import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/button';
import { useUIStore } from '../../store/uiStore';

// Navigation items configuration
const NAV_ITEMS = [
  {
    label: 'Inbox',
    path: ROUTES.CONTENT.INBOX,
    icon: InboxIcon,
    description: 'View and process captured content'
  },
  {
    label: 'Study',
    path: ROUTES.STUDY.HOME,
    icon: BookOpenIcon,
    description: 'Start study sessions and review cards'
  },
  {
    label: 'Cards',
    path: ROUTES.CARDS.LIST,
    icon: LayersIcon,
    description: 'Manage your flashcards'
  },
  {
    label: 'Settings',
    path: ROUTES.SETTINGS.HOME,
    icon: SettingsIcon,
    description: 'Configure application settings'
  }
] as const;

/**
 * NavigationBar component provides primary navigation and user controls
 */
const NavigationBar: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { isMobile, breakpoint } = useUIStore(state => state.responsive);
  const { toggleSidebar, showToast } = useUIStore();

  /**
   * Determines if a route is currently active
   */
  const isActiveRoute = useCallback((path: string): boolean => {
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  /**
   * Handles user logout with error handling
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      showToast({
        type: 'success',
        message: 'Successfully logged out'
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Logout failed. Please try again.'
      });
    }
  }, [logout, showToast]);

  // Early return if not authenticated
  if (!isAuthenticated) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo and Mobile Menu */}
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSidebar()}
              aria-label="Toggle menu"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          )}
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/logo.svg" 
              alt="membo.ai" 
              className="h-8 w-8"
            />
            {breakpoint !== 'mobile' && (
              <span className="font-semibold text-xl">membo.ai</span>
            )}
          </Link>
        </div>

        {/* Main Navigation */}
        {breakpoint !== 'mobile' && (
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ label, path, icon: Icon, description }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md transition-colors
                  ${isActiveRoute(path) 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}
                `}
                title={description}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* User Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            <span className="absolute top-0 right-0 h-2 w-2 bg-primary rounded-full" />
          </Button>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              aria-label="User menu"
            >
              <UserIcon className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOutIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;