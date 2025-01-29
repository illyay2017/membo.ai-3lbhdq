-- Enable RLS for study sessions
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own study sessions" ON public.study_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions" ON public.study_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study sessions" ON public.study_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION public.calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for session duration
CREATE TRIGGER update_session_duration
    BEFORE UPDATE ON public.study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_session_duration();

-- Functions for study analytics
CREATE OR REPLACE FUNCTION public.calculate_study_streak(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    streak INTEGER;
BEGIN
    WITH daily_sessions AS (
        SELECT DISTINCT date_trunc('day', start_time) as study_date
        FROM public.study_sessions
        WHERE user_id = user_uuid
        AND status = 'completed'
        ORDER BY study_date DESC
    )
    SELECT count(*)
    INTO streak
    FROM (
        SELECT study_date,
               row_number() OVER (ORDER BY study_date DESC) as row_num,
               date_trunc('day', study_date) - 
               (row_number() OVER (ORDER BY study_date DESC) || ' days')::interval as grp
        FROM daily_sessions
    ) t
    WHERE grp = (
        SELECT date_trunc('day', max(study_date)) - 
               (row_number() OVER (ORDER BY study_date DESC) || ' days')::interval
        FROM daily_sessions
        LIMIT 1
    );
    
    RETURN streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update study streak
CREATE OR REPLACE FUNCTION public.update_study_streak()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.users
        SET preferences = jsonb_set(
            preferences,
            '{studyStreak}',
            to_jsonb(calculate_study_streak(NEW.user_id))
        )
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_study_session_complete
    AFTER UPDATE ON public.study_sessions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.update_study_streak();

-- Set up realtime
ALTER publication supabase_realtime ADD TABLE public.study_sessions;
