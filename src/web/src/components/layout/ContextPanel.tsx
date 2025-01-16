import React, { useMemo, useCallback } from 'react';
import { classNames } from 'classnames'; // v2.3.2
import { Button, buttonVariants } from '../ui/button';
import StudyStats from '../study/StudyStats';
import ProgressBar from '../study/ProgressBar';
import { useStudySession } from '../../hooks/useStudySession';
import { VoiceRecognitionState } from '../../types/voice';
import { colors } from '../../constants/theme';

// Interface for component props
interface ContextPanelProps {
  className?: string;
  isStudyMode?: boolean;
  studySession?: StudySession | null;
}

// Quick action type definition
interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

/**
 * ContextPanel Component
 * Renders the right-side context panel with quick actions, recent items, and study statistics
 */
const ContextPanel: React.FC<ContextPanelProps> = ({
  className,
  isStudyMode = false,
  studySession = null
}) => {
  // Get study session data with offline support
  const {
    session,
    performance,
    voiceMode,
    offlineMode,
    toggleVoiceMode,
    endSession
  } = useStudySession();

  // Memoized quick actions
  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'voice',
      label: voiceMode.enabled ? 'Disable Voice' : 'Enable Voice',
      icon: voiceMode.enabled ? '🎤' : '🔇',
      onClick: toggleVoiceMode,
      variant: voiceMode.enabled ? 'primary' : 'outline',
      disabled: voiceMode.state === VoiceRecognitionState.ERROR
    },
    {
      id: 'end',
      label: 'End Session',
      icon: '⏹️',
      onClick: endSession,
      variant: 'secondary',
      disabled: !session
    }
  ], [voiceMode, session, toggleVoiceMode, endSession]);

  // Render quick actions section
  const renderQuickActions = useCallback(() => (
    <div
      className="space-y-2 p-4 border-b border-gray-200 dark:border-gray-700"
      aria-label="Quick actions"
      role="toolbar"
    >
      {quickActions.map((action) => (
        <Button
          key={action.id}
          onClick={action.onClick}
          className={classNames(
            buttonVariants({ variant: action.variant }),
            'w-full justify-start'
          )}
          disabled={action.disabled}
          aria-label={action.label}
        >
          <span className="mr-2" aria-hidden="true">{action.icon}</span>
          {action.label}
        </Button>
      ))}
    </div>
  ), [quickActions]);

  // Render recent items section with virtualization
  const renderRecentItems = useCallback(() => (
    <div
      className="p-4 space-y-2"
      aria-label="Recent items"
      role="list"
    >
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Recent Items
      </h3>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {session?.cardsStudied.slice(-5).map((card) => (
          <div
            key={card.id}
            className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            role="listitem"
          >
            <p className="text-sm truncate">{card.frontContent.text}</p>
            <span className="text-xs text-gray-500">
              {new Date(card.fsrsData.lastReview).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  ), [session?.cardsStudied]);

  // Container classes with responsive design
  const containerClasses = classNames(
    'fixed right-0 top-16 bottom-0 w-64 lg:w-80',
    'bg-white dark:bg-gray-800',
    'border-l border-gray-200 dark:border-gray-700',
    'overflow-y-auto shadow-sm',
    'transition-transform duration-200 ease-in-out',
    'transform translate-x-0 sm:translate-x-full',
    className
  );

  return (
    <aside
      className={containerClasses}
      aria-label="Context panel"
      role="complementary"
    >
      {/* Study Progress Section */}
      {isStudyMode && session && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <ProgressBar
            current={session.cardsStudied.length}
            total={session.settings.cardsPerSession}
            showPercentage
            variant={offlineMode ? 'warning' : 'default'}
            ariaLabel="Study session progress"
          />
        </div>
      )}

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Study Statistics */}
      {isStudyMode && session && (
        <div className="p-4">
          <StudyStats
            variant="detailed"
            showVoiceMetrics={voiceMode.enabled}
            className="mb-4"
          />
        </div>
      )}

      {/* Recent Items */}
      {session && renderRecentItems()}

      {/* Offline Mode Indicator */}
      {offlineMode && (
        <div
          className="p-4 bg-yellow-50 dark:bg-yellow-900 border-t border-yellow-200 dark:border-yellow-800"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Offline Mode - Changes will sync when connection is restored
          </p>
        </div>
      )}
    </aside>
  );
};

// Export component
export default ContextPanel;