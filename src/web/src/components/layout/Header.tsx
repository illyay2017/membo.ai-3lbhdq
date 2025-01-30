/**
 * Main header component for membo.ai web application
 * Implements responsive navigation, user profile access, and theme controls
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  Settings, 
  User, 
  Sun, 
  Moon, 
  LogOut,
  ChevronDown,
  Loader2Icon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/button';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../constants/theme';

// Constants for component styling and behavior
const HEADER_HEIGHT = '64px';
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const ANIMATION_DURATION = 200;

interface HeaderProps {
  className?: string;
  showMobileMenu?: boolean;
  onMobileMenuToggle?: (isOpen: boolean) => void;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  className = '',
  showMobileMenu = false,
  onMobileMenuToggle
}) => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { isMobile, isTablet, theme } = useUIStore();

  // Handle user logout with proper error handling
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      useUIStore.getState().showToast({
        type: 'error',
        message: 'Failed to logout. Please try again.'
      });
    }
  }, [logout]);

  // Handle mobile menu toggle with accessibility
  const handleMobileMenu = useCallback((isOpen: boolean) => {
    if (onMobileMenuToggle) {
      onMobileMenuToggle(isOpen);
      
      // Manage focus trap and aria attributes
      const menuButton = document.querySelector('[aria-label="Toggle menu"]');
      if (menuButton) {
        menuButton.setAttribute('aria-expanded', isOpen.toString());
      }
    }
  }, [onMobileMenuToggle]);

  // Update header height on resize
  useEffect(() => {
    document.documentElement.style.setProperty('--header-height', HEADER_HEIGHT);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-gray-200 dark:border-gray-800 ${className}`}
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="h-full max-w-screen-xl mx-auto px-4 flex items-center justify-between">
        {/* Left section: Logo and mobile menu */}
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle menu"
              onClick={() => handleMobileMenu(!showMobileMenu)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          <Link 
            to="/" 
            className="flex items-center gap-2"
            aria-label="membo.ai home"
          >
            <img 
              src="/logo.svg" 
              alt="membo.ai logo" 
              className="h-8 w-8"
            />
            {!isMobile && (
              <span className="text-xl font-semibold text-primary">
                membo.ai
              </span>
            )}
          </Link>
        </div>

        {/* Right section: User controls */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <Button
                variant="ghost"
                size="sm"
                aria-label="View notifications"
                className="relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-accent rounded-full" />
              </Button>

              {/* Settings */}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open settings"
              >
                <Settings className="h-5 w-5" />
              </Button>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Switch to ${theme.mode === 'dark' ? 'light' : 'dark'} mode`}
                onClick={() => useUIStore.getState().setTheme(
                  theme.mode === 'dark' ? 'light' : 'dark'
                )}
              >
                {theme.mode === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              {/* User profile */}
              <div className="relative ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                  aria-label="Open user menu"
                >
                  <User className="h-5 w-5" />
                  {!isMobile && (
                    <>
                      <span>{user?.firstName}</span>
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Logout"
                onClick={handleLogout}
                disabled={isLoading}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link to="/login">Login</Link>
              </Button>
              <Button
                variant="primary"
                size="sm"
                asChild
              >
                <Link to="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
