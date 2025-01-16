import React, { useMemo } from 'react';
import { StudySession } from '../../types/study';
import { useStudySession } from '../../hooks/useStudySession';
import Card from '../ui/card';

/**
 * Props interface for StudyStats component
 */
interface StudyStatsProps {
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showVoiceMetrics?: boolean;
}

/**
 * Formats duration in seconds to human-readable string
 * @param timeInSeconds - Time duration in seconds
 */
const formatDuration = (timeInSeconds: number): string => {
  if (timeInSeconds < 60) {
    return `${timeInSeconds}s`;
  } else if (timeInSeconds < 3600) {
    const minutes = Math.floor(timeInSeconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

/**
 * Formats decimal to percentage with specified precision
 * @param value - Decimal value between 0 and 1
 * @param precision - Number of decimal places
 */
const formatPercentage = (value: number, precision: number = 1): string => {
  return `${(value * 100).toFixed(precision)}%`;
};

/**
 * StudyStats component displays comprehensive study session statistics
 * with real-time FSRS progress tracking and offline support
 */
export const StudyStats: React.FC<StudyStatsProps> = ({
  className = '',
  variant = 'default',
  showVoiceMetrics = false
}) => {
  // Get current session data with offline support
  const { session, performance, isOffline } = useStudySession();

  // Calculate derived statistics
  const stats = useMemo(() => {
    if (!session || !performance) return null;

    return {
      retentionRate: formatPercentage(performance.retentionRate),
      correctRate: formatPercentage(
        performance.correctCount / (performance.totalCards || 1)
      ),
      averageConfidence: formatPercentage(performance.averageConfidence),
      timeSpent: formatDuration(performance.timeSpent / 1000),
      studyStreak: `${performance.studyStreak} days`,
      fsrsProgress: {
        stability: formatPercentage(performance.fsrsProgress.averageStability),
        difficulty: formatPercentage(performance.fsrsProgress.averageDifficulty),
        retention: formatPercentage(performance.fsrsProgress.retentionRate)
      }
    };
  }, [session, performance]);

  if (!stats) {
    return null;
  }

  // Determine card variant based on offline status
  const cardVariant = isOffline ? 'default' : 'elevated';

  return (
    <Card
      variant={cardVariant}
      className={`study-stats ${className}`}
      aria-label="Study Session Statistics"
    >
      <div className="grid gap-4">
        {/* Primary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="stat-item" role="status">
            <h4 className="text-sm font-medium text-secondary">Retention Rate</h4>
            <p className="text-2xl font-semibold">{stats.retentionRate}</p>
          </div>
          <div className="stat-item" role="status">
            <h4 className="text-sm font-medium text-secondary">Correct Rate</h4>
            <p className="text-2xl font-semibold">{stats.correctRate}</p>
          </div>
          <div className="stat-item" role="status">
            <h4 className="text-sm font-medium text-secondary">Study Streak</h4>
            <p className="text-2xl font-semibold">{stats.studyStreak}</p>
          </div>
        </div>

        {/* FSRS Progress */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-secondary mb-2">FSRS Progress</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-item" role="status">
              <span className="text-xs text-secondary">Stability</span>
              <p className="text-lg font-medium">{stats.fsrsProgress.stability}</p>
            </div>
            <div className="stat-item" role="status">
              <span className="text-xs text-secondary">Difficulty</span>
              <p className="text-lg font-medium">{stats.fsrsProgress.difficulty}</p>
            </div>
            <div className="stat-item" role="status">
              <span className="text-xs text-secondary">Retention</span>
              <p className="text-lg font-medium">{stats.fsrsProgress.retention}</p>
            </div>
          </div>
        </div>

        {/* Session Details */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-item" role="status">
              <h4 className="text-sm font-medium text-secondary">Time Spent</h4>
              <p className="text-lg font-medium">{stats.timeSpent}</p>
            </div>
            <div className="stat-item" role="status">
              <h4 className="text-sm font-medium text-secondary">Confidence</h4>
              <p className="text-lg font-medium">{stats.averageConfidence}</p>
            </div>
          </div>
        </div>

        {/* Voice Metrics (if enabled) */}
        {showVoiceMetrics && session?.mode === 'voice' && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-secondary mb-2">Voice Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-item" role="status">
                <span className="text-xs text-secondary">Recognition Rate</span>
                <p className="text-lg font-medium">
                  {formatPercentage(performance.voiceMetrics?.recognitionRate || 0)}
                </p>
              </div>
              <div className="stat-item" role="status">
                <span className="text-xs text-secondary">Average Response Time</span>
                <p className="text-lg font-medium">
                  {formatDuration(performance.voiceMetrics?.averageResponseTime || 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Offline Indicator */}
        {isOffline && (
          <div className="text-sm text-warning mt-2" role="status">
            ⚠️ Offline Mode - Stats will sync when connection is restored
          </div>
        )}
      </div>
    </Card>
  );
};

export default StudyStats;