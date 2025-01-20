-- Migration: Add Study Analytics
-- Description: Adds comprehensive analytics tables and functions for tracking study performance metrics

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM type for study modes if not exists
DO $$ BEGIN
    CREATE TYPE study_mode AS ENUM ('standard', 'voice', 'quiz');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create study metrics table for daily aggregated metrics
CREATE TABLE study_metrics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    total_study_time interval NOT NULL DEFAULT '0',
    cards_studied integer NOT NULL DEFAULT 0,
    correct_answers integer NOT NULL DEFAULT 0,
    retention_rate decimal(5,2) NOT NULL DEFAULT 0,
    study_streak integer NOT NULL DEFAULT 0,
    voice_mode_usage interval DEFAULT '0',
    quiz_mode_usage interval DEFAULT '0',
    average_response_time interval DEFAULT '0',
    learning_efficiency decimal(5,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT study_metrics_user_date_unique UNIQUE (user_id, date)
);

-- Create performance analytics table for session-level metrics
CREATE TABLE performance_analytics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    session_id uuid REFERENCES study_sessions(id) ON DELETE CASCADE,
    study_mode study_mode NOT NULL,
    average_confidence decimal(5,2),
    response_time interval,
    fsrs_metrics jsonb DEFAULT '{}'::jsonb,
    cards_per_hour decimal(8,2),
    error_patterns jsonb DEFAULT '{}'::jsonb,
    learning_curve decimal(5,2)[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Create engagement metrics table for weekly tracking
CREATE TABLE engagement_metrics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    week_start_date date NOT NULL,
    active_days integer NOT NULL DEFAULT 0,
    total_sessions integer NOT NULL DEFAULT 0,
    avg_session_duration interval,
    completion_rate decimal(5,2),
    retention_score decimal(5,2),
    engagement_index decimal(5,2),
    feature_usage jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT engagement_metrics_user_week_unique UNIQUE (user_id, week_start_date)
);

-- Create function to calculate retention rate
CREATE OR REPLACE FUNCTION calculate_retention_rate(user_id uuid, study_date date)
RETURNS decimal AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (CAST(correct_answers AS decimal) / NULLIF(cards_studied, 0) * 100),
            0
        )
        FROM study_metrics
        WHERE user_id = calculate_retention_rate.user_id
        AND date = calculate_retention_rate.study_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update study streak
CREATE OR REPLACE FUNCTION update_study_streak(user_id uuid)
RETURNS integer AS $$
DECLARE
    current_streak integer;
BEGIN
    SELECT 
        CASE 
            WHEN MAX(date) = CURRENT_DATE THEN
                COALESCE(
                    (SELECT COUNT(*)
                    FROM generate_series(
                        (SELECT MAX(date) - (SELECT COUNT(*) - 1)
                        FROM study_metrics sm2
                        WHERE sm2.user_id = update_study_streak.user_id
                        AND sm2.cards_studied > 0
                        AND sm2.date >= (SELECT MAX(date) - interval '30 days')::date
                        GROUP BY user_id
                        HAVING COUNT(*) = SUM(CASE WHEN date = date - (ROW_NUMBER() OVER (ORDER BY date DESC))::integer THEN 1 ELSE 0 END)),
                        MAX(date),
                        '1 day'::interval
                    ) d
                    WHERE EXISTS (
                        SELECT 1
                        FROM study_metrics sm3
                        WHERE sm3.user_id = update_study_streak.user_id
                        AND sm3.date = d::date
                        AND sm3.cards_studied > 0
                    )),
                    1)
            ELSE 0
        END
    INTO current_streak
    FROM study_metrics
    WHERE user_id = update_study_streak.user_id
    AND cards_studied > 0;

    RETURN COALESCE(current_streak, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate engagement metrics
CREATE OR REPLACE FUNCTION calculate_engagement_metrics()
RETURNS void AS $$
BEGIN
    INSERT INTO engagement_metrics (
        user_id,
        week_start_date,
        active_days,
        total_sessions,
        avg_session_duration,
        completion_rate,
        retention_score,
        engagement_index,
        feature_usage
    )
    SELECT 
        user_id,
        date_trunc('week', CURRENT_DATE)::date,
        COUNT(DISTINCT date),
        COUNT(*),
        AVG(total_study_time),
        AVG(CAST(correct_answers AS decimal) / NULLIF(cards_studied, 0) * 100),
        AVG(retention_rate),
        (
            COUNT(DISTINCT date)::decimal / 7 * 0.4 +
            AVG(retention_rate) * 0.3 +
            LEAST(AVG(EXTRACT(epoch FROM total_study_time)) / 900, 1) * 0.3
        ),
        jsonb_build_object(
            'voice_usage', SUM(EXTRACT(epoch FROM voice_mode_usage)),
            'quiz_usage', SUM(EXTRACT(epoch FROM quiz_mode_usage))
        )
    FROM study_metrics
    WHERE date >= date_trunc('week', CURRENT_DATE)
    GROUP BY user_id
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET
        active_days = EXCLUDED.active_days,
        total_sessions = EXCLUDED.total_sessions,
        avg_session_duration = EXCLUDED.avg_session_duration,
        completion_rate = EXCLUDED.completion_rate,
        retention_score = EXCLUDED.retention_score,
        engagement_index = EXCLUDED.engagement_index,
        feature_usage = EXCLUDED.feature_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update performance analytics
CREATE OR REPLACE FUNCTION update_performance_analytics(session_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO performance_analytics (
        user_id,
        session_id,
        study_mode,
        average_confidence,
        response_time,
        fsrs_metrics,
        cards_per_hour,
        error_patterns,
        learning_curve
    )
    SELECT 
        ss.user_id,
        ss.id,
        ss.study_mode::study_mode,
        ss.average_confidence,
        ss.average_response_time,
        ss.fsrs_data,
        (ss.cards_reviewed::decimal / EXTRACT(epoch FROM ss.duration) * 3600),
        ss.error_data,
        ss.learning_progress
    FROM study_sessions ss
    WHERE ss.id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create optimized indexes
CREATE INDEX idx_study_metrics_user_date ON study_metrics(user_id, date);
CREATE INDEX idx_performance_analytics_session ON performance_analytics(session_id);
CREATE INDEX idx_engagement_metrics_user_week ON engagement_metrics(user_id, week_start_date);
CREATE INDEX idx_study_metrics_retention ON study_metrics(user_id, retention_rate) WHERE retention_rate > 0;
CREATE INDEX idx_performance_analytics_fsrs ON performance_analytics USING gin (fsrs_metrics);
CREATE INDEX idx_engagement_metrics_active ON engagement_metrics(user_id) WHERE active_days > 0;

-- Enable row level security
ALTER TABLE study_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY study_metrics_access ON study_metrics 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid());

CREATE POLICY performance_analytics_access ON performance_analytics 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid());

CREATE POLICY engagement_metrics_access ON engagement_metrics 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid());

-- Rollback function
CREATE OR REPLACE FUNCTION rollback_study_analytics()
RETURNS void AS $$
BEGIN
    DROP TABLE IF EXISTS study_metrics CASCADE;
    DROP TABLE IF EXISTS performance_analytics CASCADE;
    DROP TABLE IF EXISTS engagement_metrics CASCADE;
    DROP FUNCTION IF EXISTS calculate_retention_rate CASCADE;
    DROP FUNCTION IF EXISTS update_study_streak CASCADE;
    DROP FUNCTION IF EXISTS calculate_engagement_metrics CASCADE;
    DROP FUNCTION IF EXISTS update_performance_analytics CASCADE;
    DROP TYPE IF EXISTS study_mode CASCADE;
END;
$$ LANGUAGE plpgsql;