/**
 * Analytics library for tracking user behavior, study performance, and system usage metrics
 * Implements privacy-focused tracking with enhanced performance monitoring
 * @version 1.0.0
 */

import mixpanel from 'mixpanel-browser'; // v2.47.0
import { UserData } from '../types/auth';
import { StudySession } from '../types/study';
import { Card } from '../types/card';

/**
 * Analytics event names with privacy flags
 */
const ANALYTICS_EVENTS = {
    USER_LOGIN: { name: 'user_login', pii: true },
    STUDY_SESSION_START: { name: 'study_session_start', pii: false },
    STUDY_SESSION_END: { name: 'study_session_end', pii: false },
    CARD_INTERACTION: { name: 'card_interaction', pii: false },
    ERROR_OCCURRED: { name: 'error_occurred', pii: false },
} as const;

/**
 * Performance monitoring thresholds
 */
const PERFORMANCE_THRESHOLDS = {
    API_RESPONSE_TIME: 200, // milliseconds
    AI_PROCESSING_TIME: 10000, // milliseconds
    VOICE_RECOGNITION_DELAY: 2000, // milliseconds
    ERROR_RATE_THRESHOLD: 0.05, // 5% error rate threshold
} as const;

/**
 * Privacy and data retention settings
 */
const PRIVACY_SETTINGS = {
    dataRetentionDays: 90,
    piiFields: ['email', 'firstName', 'lastName'],
    ipAnonymization: true,
    gdprCompliance: true,
} as const;

/**
 * Error impact severity levels
 */
enum ERROR_IMPACT_LEVELS {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * Analytics configuration interface
 */
interface AnalyticsConfig {
    enableTracking: boolean;
    privacySettings?: typeof PRIVACY_SETTINGS;
    performanceThresholds?: typeof PERFORMANCE_THRESHOLDS;
}

/**
 * Initializes the analytics service with privacy controls and performance monitoring
 */
function initializeAnalytics(projectToken: string, config: AnalyticsConfig): void {
    mixpanel.init(projectToken, {
        api_host: 'https://api-eu.mixpanel.com',
        persistence: 'localStorage',
        ip: !PRIVACY_SETTINGS.ipAnonymization,
        property_blacklist: PRIVACY_SETTINGS.piiFields,
        ignore_dnt: false,
        batch_requests: true,
        batch_size: 50,
    });

    if (config.privacySettings?.gdprCompliance) {
        mixpanel.opt_in_tracking();
    }

    // Set default properties for all events
    mixpanel.register({
        app_version: process.env.REACT_APP_VERSION,
        platform: 'web',
        environment: process.env.NODE_ENV,
    });
}

/**
 * Anonymizes PII data based on privacy settings
 */
function anonymizeUserData(userData: UserData): Partial<UserData> {
    const { id, role } = userData;
    return { id: mixpanel.hash(id), role };
}

/**
 * Tracks user login events with enhanced privacy controls
 */
function trackUserLogin(userData: UserData): void {
    const anonymizedData = anonymizeUserData(userData);
    
    mixpanel.identify(anonymizedData.id);
    mixpanel.people.set({
        $last_login: new Date().toISOString(),
        user_role: anonymizedData.role,
    });

    mixpanel.track(ANALYTICS_EVENTS.USER_LOGIN.name, {
        user_role: anonymizedData.role,
        login_time: new Date().toISOString(),
    });
}

/**
 * Tracks study session metrics with performance monitoring
 */
function trackStudySession(session: StudySession): void {
    const {
        id,
        mode,
        performance,
        settings,
        startTime,
        endTime,
    } = session;

    // Track session start
    mixpanel.track(ANALYTICS_EVENTS.STUDY_SESSION_START.name, {
        session_id: id,
        study_mode: mode,
        voice_enabled: settings.voiceEnabled,
        fsrs_enabled: settings.enableFSRS,
    });

    // Track session completion and performance
    if (endTime) {
        const sessionDuration = endTime.getTime() - startTime.getTime();
        const retentionRate = performance.retentionRate;

        mixpanel.track(ANALYTICS_EVENTS.STUDY_SESSION_END.name, {
            session_id: id,
            duration_ms: sessionDuration,
            cards_studied: performance.totalCards,
            correct_count: performance.correctCount,
            retention_rate: retentionRate,
            study_streak: performance.studyStreak,
            average_confidence: performance.averageConfidence,
            fsrs_progress: performance.fsrsProgress,
        });

        // Track performance anomalies
        if (sessionDuration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
            trackError(
                new Error('Session duration threshold exceeded'),
                'study_session_performance'
            );
        }
    }
}

/**
 * Tracks card interactions including AI performance metrics
 */
function trackCardInteraction(card: Card, interactionType: string): void {
    const {
        id,
        fsrsData,
        frontContent,
        backContent,
        compatibleModes,
    } = card;

    mixpanel.track(ANALYTICS_EVENTS.CARD_INTERACTION.name, {
        card_id: id,
        interaction_type: interactionType,
        ai_generated: frontContent.aiGenerated || backContent.aiGenerated,
        ai_processing_time: frontContent.metadata.processingTime,
        fsrs_stability: fsrsData.stability,
        fsrs_difficulty: fsrsData.difficulty,
        study_modes: compatibleModes,
        response_time: Date.now(),
    });

    // Monitor AI processing performance
    if (frontContent.metadata.processingTime > PERFORMANCE_THRESHOLDS.AI_PROCESSING_TIME) {
        trackError(
            new Error('AI processing time threshold exceeded'),
            'card_generation_performance'
        );
    }
}

/**
 * Enhanced error tracking with impact assessment
 */
function trackError(error: Error, context: string): void {
    const timestamp = new Date().toISOString();
    const errorImpact = assessErrorImpact(error, context);

    mixpanel.track(ANALYTICS_EVENTS.ERROR_OCCURRED.name, {
        error_message: error.message,
        error_stack: error.stack,
        error_context: context,
        error_impact: errorImpact,
        timestamp,
    });

    // Trigger immediate notification for critical errors
    if (errorImpact === ERROR_IMPACT_LEVELS.CRITICAL) {
        notifyCriticalError(error, context);
    }
}

/**
 * Assesses the impact level of an error
 */
function assessErrorImpact(error: Error, context: string): ERROR_IMPACT_LEVELS {
    // Implementation based on error type and context
    if (context.includes('study_session_performance')) {
        return ERROR_IMPACT_LEVELS.MEDIUM;
    }
    if (context.includes('card_generation_performance')) {
        return ERROR_IMPACT_LEVELS.HIGH;
    }
    return ERROR_IMPACT_LEVELS.LOW;
}

/**
 * Notifies relevant systems of critical errors
 */
function notifyCriticalError(error: Error, context: string): void {
    console.error('[CRITICAL ERROR]', {
        error,
        context,
        timestamp: new Date().toISOString(),
    });
    // Additional notification logic would be implemented here
}

// Export analytics functions
export const analytics = {
    initializeAnalytics,
    trackUserLogin,
    trackStudySession,
    trackCardInteraction,
    trackError,
};