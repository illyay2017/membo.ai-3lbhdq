-- Add analytics tables focusing on aggregated metrics
CREATE TABLE study_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    cards_studied INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    fsrs_metrics JSONB NOT NULL DEFAULT '{
        "averageStability": 0,
        "averageDifficulty": 0,
        "retentionRate": 0,
        "intervalProgress": 0
    }',
    study_modes_usage JSONB NOT NULL DEFAULT '{
        "standard": 0,
        "quiz": 0,
        "voice": 0
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_analytics_user_date_unique UNIQUE (user_id, date)
);

-- Weekly engagement tracking
CREATE TABLE engagement_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    active_days INTEGER NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    avg_session_length INTEGER NOT NULL DEFAULT 0,
    completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT engagement_week_unique UNIQUE (user_id, week_start)
);

-- Enable RLS
ALTER TABLE study_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own analytics" ON study_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own engagement" ON engagement_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO study_analytics (
        user_id,
        date,
        cards_studied,
        time_spent_seconds,
        correct_answers,
        fsrs_metrics
    )
    VALUES (
        NEW.user_id,
        date_trunc('day', NEW.end_time)::date,
        array_length(NEW.cards_studied, 1),
        NEW.duration_seconds,
        (NEW.performance->>'correct')::integer,
        jsonb_build_object(
            'averageStability', NEW.performance->'fsrsProgress'->>'averageStability',
            'averageDifficulty', NEW.performance->'fsrsProgress'->>'averageDifficulty',
            'retentionRate', NEW.performance->'fsrsProgress'->>'retentionRate',
            'intervalProgress', NEW.performance->'fsrsProgress'->>'intervalProgress'
        )
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        cards_studied = study_analytics.cards_studied + EXCLUDED.cards_studied,
        time_spent_seconds = study_analytics.time_spent_seconds + EXCLUDED.time_spent_seconds,
        correct_answers = study_analytics.correct_answers + EXCLUDED.correct_answers,
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics when session completes
CREATE TRIGGER on_session_complete
    AFTER UPDATE ON study_sessions
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION update_daily_analytics();

-- Weekly engagement calculation function
CREATE OR REPLACE FUNCTION calculate_weekly_engagement()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO engagement_metrics (
        user_id,
        week_start,
        active_days,
        total_sessions,
        avg_session_length,
        completion_rate
    )
    SELECT 
        user_id,
        date_trunc('week', date)::date as week_start,
        count(DISTINCT date) as active_days,
        count(*) as total_sessions,
        avg(time_spent_seconds)::integer as avg_session_length,
        (sum(correct_answers)::decimal / nullif(sum(cards_studied), 0) * 100)::decimal(5,2) as completion_rate
    FROM study_analytics
    WHERE user_id = NEW.user_id
    AND date >= date_trunc('week', NEW.date)
    AND date < date_trunc('week', NEW.date) + interval '1 week'
    GROUP BY user_id, week_start
    ON CONFLICT (user_id, week_start)
    DO UPDATE SET
        active_days = EXCLUDED.active_days,
        total_sessions = EXCLUDED.total_sessions,
        avg_session_length = EXCLUDED.avg_session_length,
        completion_rate = EXCLUDED.completion_rate,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update weekly engagement
CREATE TRIGGER on_analytics_update
    AFTER INSERT OR UPDATE ON study_analytics
    FOR EACH ROW
    EXECUTE FUNCTION calculate_weekly_engagement();

-- Indexes for performance
CREATE INDEX idx_study_analytics_user_date ON study_analytics(user_id, date);
CREATE INDEX idx_engagement_metrics_user_week ON engagement_metrics(user_id, week_start);
