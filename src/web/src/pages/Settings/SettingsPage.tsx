import React, { Suspense, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ErrorBoundary } from 'react-error-boundary';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAnalytics } from '@analytics/core';
import AppShell from '../../components/layout/AppShell';
import PreferencesPage from './PreferencesPage';
import ProfilePage from './ProfilePage';

// Interface for settings tab data with access control
interface SettingsTabsData {
  id: string;
  label: string;
  component: React.FC;
  requiredRole: string;
  analyticsId: string;
}

// Available settings tabs configuration
const SETTINGS_TABS: SettingsTabsData[] = [
  {
    id: 'profile',
    label: 'Profile',
    component: ProfilePage,
    requiredRole: 'user',
    analyticsId: 'settings_profile'
  },
  {
    id: 'preferences',
    label: 'Preferences',
    component: PreferencesPage,
    requiredRole: 'user',
    analyticsId: 'settings_preferences'
  }
];

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
      Something went wrong
    </h3>
    <p className="text-sm text-red-500 dark:text-red-300">
      {error.message}
    </p>
  </div>
);

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
  </div>
);

const SettingsPage: React.FC = () => {
  const { hasAccess } = useRoleAccess();
  const analytics = useAnalytics();

  // Handle tab changes with analytics tracking
  const handleTabChange = useCallback((tabId: string) => {
    const tab = SETTINGS_TABS.find(t => t.id === tabId);
    if (!tab) return;

    // Track tab change in analytics
    analytics.track('settings_tab_change', {
      tabId: tab.id,
      analyticsId: tab.analyticsId
    });
  }, [analytics]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
        </div>

        <Tabs.Root
          defaultValue="profile"
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          {/* Tabs List */}
          <Tabs.List
            className="flex space-x-4 border-b border-gray-200 dark:border-gray-700"
            aria-label="Settings sections"
          >
            {SETTINGS_TABS.map(tab => (
              hasAccess(tab.requiredRole) && (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 
                           dark:text-gray-400 dark:hover:text-gray-200 
                           focus:outline-none focus:ring-2 focus:ring-primary-500
                           data-[state=active]:text-primary-600 
                           data-[state=active]:border-b-2 
                           data-[state=active]:border-primary-600
                           dark:data-[state=active]:text-primary-400"
                >
                  {tab.label}
                </Tabs.Trigger>
              )
            ))}
          </Tabs.List>

          {/* Tab Panels */}
          {SETTINGS_TABS.map(tab => (
            hasAccess(tab.requiredRole) && (
              <Tabs.Content
                key={tab.id}
                value={tab.id}
                className="focus:outline-none"
              >
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <Suspense fallback={<LoadingFallback />}>
                    <tab.component />
                  </Suspense>
                </ErrorBoundary>
              </Tabs.Content>
            )
          ))}
        </Tabs.Root>
      </div>
    </AppShell>
  );
};

export default SettingsPage;