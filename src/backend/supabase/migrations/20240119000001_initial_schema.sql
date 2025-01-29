-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom enumeration types
CREATE TYPE user_role AS ENUM (
    'FREE_USER',
    'PRO_USER', 
    'POWER_USER',
    'ENTERPRISE_ADMIN',
    'SYSTEM_ADMIN'
);

CREATE TYPE content_status AS ENUM (
    'NEW',
    'PROCESSING',
    'PROCESSED',
    'ARCHIVED',
    'ERROR'
);

CREATE TYPE study_mode AS ENUM (
    'STANDARD',
    'VOICE',
    'QUIZ'
);

-- Core tables
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'FREE_USER',
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    last_access timestamptz DEFAULT now(),
    CONSTRAINT valid_preferences CHECK (
        jsonb_typeof(preferences) = 'object' AND
        (preferences->>'studyMode')::text IN ('STANDARD', 'VOICE', 'QUIZ') AND
        jsonb_typeof(preferences->'voiceEnabled') = 'boolean' AND
        (preferences->>'dailyGoal')::integer > 0 AND
        jsonb_typeof(preferences->'notifications') = 'object' AND
        jsonb_typeof(preferences->'notifications'->'email') = 'boolean' AND
        jsonb_typeof(preferences->'notifications'->'push') = 'boolean' AND
        jsonb_typeof(preferences->'notifications'->'studyReminders') = 'boolean' AND
        (preferences->>'theme')::text IN ('light', 'dark', 'system') AND
        (preferences->>'language')::text ~ '^[a-z]{2}$'
    )
);

CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    status content_status NOT NULL DEFAULT 'NEW',
    source_url TEXT,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_details TEXT,
    CONSTRAINT content_not_empty CHECK (length(content) > 0)
);

CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    front_content JSONB NOT NULL,
    back_content JSONB NOT NULL,
    fsrs_data JSONB NOT NULL DEFAULT '{
        "stability": 0.5,
        "difficulty": 0.3,
        "reviewCount": 0,
        "lastReview": null,
        "lastRating": 0
    }',
    next_review TIMESTAMP WITH TIME ZONE NOT NULL,
    compatible_modes TEXT[] NOT NULL DEFAULT '{STANDARD}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_fsrs_data CHECK (
        jsonb_typeof(fsrs_data->'stability') = 'number' AND
        jsonb_typeof(fsrs_data->'difficulty') = 'number' AND
        jsonb_typeof(fsrs_data->'reviewCount') = 'number' AND
        (
            fsrs_data->>'lastReview' IS NULL OR 
            jsonb_typeof(fsrs_data->'lastReview') = 'string'
        ) AND
        jsonb_typeof(fsrs_data->'lastRating') = 'number'
    )
);

CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode study_mode NOT NULL DEFAULT 'STANDARD',
    cards_studied UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    performance JSONB NOT NULL DEFAULT '{"correct": 0, "incorrect": 0}',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    CONSTRAINT valid_performance_data CHECK (
        jsonb_typeof(performance->'correct') = 'number' AND
        jsonb_typeof(performance->'incorrect') = 'number'
    )
);

-- Performance indexes
CREATE INDEX idx_content_user_status ON content(user_id, status);
CREATE INDEX idx_cards_next_review ON cards(user_id, next_review);
CREATE INDEX idx_study_sessions_user ON study_sessions(user_id, start_time);
CREATE INDEX idx_cards_tags ON cards USING gin(tags);
CREATE INDEX idx_content_full_text ON content USING gin(to_tsvector('english', content));

-- Enable row level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Row level security policies
CREATE POLICY users_self_access ON users
    FOR ALL
    USING (id = auth.uid());

CREATE POLICY content_owner_access ON content
    FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY cards_owner_access ON cards
    FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY study_sessions_owner_access ON study_sessions
    FOR ALL
    USING (user_id = auth.uid());

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate study session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_duration
    BEFORE UPDATE ON study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_session_duration();

-- Create trigger to automatically create user record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_preferences jsonb;
BEGIN
    -- Extract preferences from raw_app_meta_data
    user_preferences := CASE 
        WHEN NEW.raw_app_meta_data->'preferences' IS NOT NULL THEN
            NEW.raw_app_meta_data->'preferences'
        ELSE 
            jsonb_build_object(
                'studyMode', 'STANDARD',
                'voiceEnabled', false,
                'dailyGoal', 20,
                'theme', 'light',
                'language', 'en',
                'notifications', jsonb_build_object(
                    'email', true,
                    'push', true,
                    'studyReminders', true
                )
            )
    END;

    -- Ensure all required fields exist with correct structure
    user_preferences := jsonb_build_object(
        'studyMode', COALESCE(user_preferences->>'studyMode', 'STANDARD'),
        'voiceEnabled', COALESCE((user_preferences->>'voiceEnabled')::boolean, false),
        'dailyGoal', COALESCE((user_preferences->>'dailyGoal')::integer, 20),
        'theme', COALESCE(user_preferences->>'theme', 'light'),
        'language', COALESCE(user_preferences->>'language', 'en'),
        'notifications', COALESCE(
            user_preferences->'notifications',
            jsonb_build_object(
                'email', COALESCE((user_preferences->>'emailNotifications')::boolean, true),
                'push', true,
                'studyReminders', true
            )
        )
    );

    -- Insert the user record with version and last_access
    INSERT INTO public.users (
        id, 
        role, 
        preferences,
        version,
        last_access
    )
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'FREE_USER'),
        user_preferences,
        1,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user record when auth.users record is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- At the start of the migration, ensure auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Ensure the auth.users table exists with correct structure
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::text,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::text,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false
);
