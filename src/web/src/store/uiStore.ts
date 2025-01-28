/**
 * Global UI state management store using Zustand
 * Handles application-wide UI state with persistence and type safety
 * @version 1.0.0
 */

import { create } from 'zustand'; // v4.x
import { persist } from 'zustand/middleware'; // v4.x
import { colors } from '../constants/theme';
import { setUserPreferences } from '../lib/storage';

// Theme mode type definition
type ThemeMode = 'light' | 'dark' | 'system';

// Toast position type definition
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

// Breakpoint type definition
type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Orientation type definition
type Orientation = 'portrait' | 'landscape';

// Toast interface
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

/**
 * Core UI state interface with strict typing
 */
interface UIState {
  theme: {
    mode: ThemeMode;
    accent: string;
    fontSize: number;
    fontFamily: string;
    spacing: number;
  };
  navigation: {
    isSidebarOpen: boolean;
    isContextPanelOpen: boolean;
    currentPath: string;
    previousPath: string;
    navigationHistory: string[];
  };
  modals: {
    activeModal: string | null;
    modalData: Record<string, unknown>;
    modalHistory: string[];
    isAnimating: boolean;
  };
  toasts: {
    items: Toast[];
    position: ToastPosition;
    maxVisible: number;
    duration: number;
  };
  responsive: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    breakpoint: Breakpoint;
    orientation: Orientation;
    viewportWidth: number;
    viewportHeight: number;
  };
  setTheme: (mode: ThemeMode, accent?: string, options?: Partial<UIState['theme']>) => void;
  updateResponsiveState: (dimensions: { width: number; height: number }) => void;
  toggleSidebar: (isOpen?: boolean) => void;
  toggleContextPanel: (isOpen?: boolean) => void;
  showModal: (modalId: string, data?: Record<string, unknown>) => void;
  hideModal: () => void;
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  setNavigationPath: (path: string) => void;
}

/**
 * Initial state configuration
 */
const INITIAL_STATE: Omit<UIState, 'setTheme' | 'updateResponsiveState' | 'toggleSidebar' | 'toggleContextPanel' | 'showModal' | 'hideModal' | 'showToast' | 'hideToast' | 'setNavigationPath'> = {
  theme: {
    mode: 'system',
    accent: colors.accent,
    fontSize: 16,
    fontFamily: 'Inter',
    spacing: 4
  },
  navigation: {
    isSidebarOpen: true,
    isContextPanelOpen: false,
    currentPath: '/',
    previousPath: '',
    navigationHistory: []
  },
  modals: {
    activeModal: null,
    modalData: {},
    modalHistory: [],
    isAnimating: false
  },
  toasts: {
    items: [],
    position: 'bottom-right',
    maxVisible: 3,
    duration: 5000
  },
  responsive: {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    breakpoint: 'desktop',
    orientation: 'landscape',
    viewportWidth: 1024,
    viewportHeight: 768
  }
};

/**
 * Create the UI store with persistence middleware
 */
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setTheme: (mode, accent, options) => {
        const newTheme = {
          ...get().theme,
          mode,
          ...(accent && { accent }),
          ...options
        };

        // Update theme state
        set({ theme: newTheme });

        // Apply theme to document
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.setProperty('--accent', newTheme.accent);

        // Persist theme preferences
        setUserPreferences({ theme: newTheme });
      },

      updateResponsiveState: ({ width, height }) => {
        const breakpoint: Breakpoint = 
          width < 768 ? 'mobile' :
          width < 1024 ? 'tablet' : 
          'desktop';

        const orientation: Orientation = width >= height ? 'landscape' : 'portrait';

        set({
          responsive: {
            isMobile: breakpoint === 'mobile',
            isTablet: breakpoint === 'tablet',
            isDesktop: breakpoint === 'desktop',
            breakpoint,
            orientation,
            viewportWidth: width,
            viewportHeight: height
          }
        });
      },

      toggleSidebar: (isOpen) => set(state => ({
        navigation: {
          ...state.navigation,
          isSidebarOpen: isOpen ?? !state.navigation.isSidebarOpen
        }
      })),

      toggleContextPanel: (isOpen) => set(state => ({
        navigation: {
          ...state.navigation,
          isContextPanelOpen: isOpen ?? !state.navigation.isContextPanelOpen
        }
      })),

      showModal: (modalId, data = {}) => set(state => ({
        modals: {
          ...state.modals,
          activeModal: modalId,
          modalData: data,
          modalHistory: [...state.modals.modalHistory, modalId],
          isAnimating: true
        }
      })),

      hideModal: () => set(state => ({
        modals: {
          ...state.modals,
          activeModal: null,
          modalData: {},
          modalHistory: state.modals.modalHistory.slice(0, -1),
          isAnimating: false
        }
      })),

      showToast: (toast) => set(state => ({
        toasts: {
          ...state.toasts,
          items: [
            ...state.toasts.items,
            { ...toast, id: crypto.randomUUID() }
          ].slice(-state.toasts.maxVisible)
        }
      })),

      hideToast: (id) => set(state => ({
        toasts: {
          ...state.toasts,
          items: state.toasts.items.filter(toast => toast.id !== id)
        }
      })),

      setNavigationPath: (path) => set(state => ({
        navigation: {
          ...state.navigation,
          previousPath: state.navigation.currentPath,
          currentPath: path,
          navigationHistory: [...state.navigation.navigationHistory, path]
        }
      }))
    }),
    {
      name: 'membo-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        navigation: {
          isSidebarOpen: state.navigation.isSidebarOpen,
          isContextPanelOpen: state.navigation.isContextPanelOpen
        }
      })
    }
  )
);

export type { UIState, ThemeMode, ToastPosition, Breakpoint, Orientation, Toast };
