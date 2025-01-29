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
CREATE TABLE public.users (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    role user_role NOT NULL DEFAULT 'FREE_USER',
    preferences jsonb DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    last_access timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
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

CREATE TABLE public.content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_type TEXT NOT NULL,
    source_url TEXT,
    status content_status NOT NULL DEFAULT 'NEW',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_metadata CHECK (
        jsonb_typeof(metadata) = 'object' AND
        (metadata->>'title' IS NULL OR jsonb_typeof(metadata->'title') = 'string') AND
        (metadata->>'author' IS NULL OR jsonb_typeof(metadata->'author') = 'string') AND
        jsonb_typeof(metadata->'tags') = 'array'
    ),
    CONSTRAINT valid_source_type CHECK (
        source_type = ANY(ARRAY['web', 'pdf', 'kindle', 'manual'])
    )
);

CREATE TABLE public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
    front_content JSONB NOT NULL,
    back_content JSONB NOT NULL,
    fsrs_data JSONB NOT NULL DEFAULT '{
        "stability": 0.5,
        "difficulty": 0.3,
        "reviewCount": 0,
        "lastReview": null,
        "lastRating": 0,
        "performanceHistory": []
    }',
    next_review TIMESTAMPTZ NOT NULL DEFAULT now(),
    compatible_modes TEXT[] NOT NULL DEFAULT '{STANDARD}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_card_content CHECK (
        (front_content->>'text' IS NOT NULL) AND
        (front_content->>'type' IN ('text', 'markdown', 'html', 'code')) AND
        (back_content->>'text' IS NOT NULL) AND
        (back_content->>'type' IN ('text', 'markdown', 'html', 'code'))
    )
);

CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode study_mode NOT NULL DEFAULT 'STANDARD',
    cards_studied UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    performance JSONB NOT NULL DEFAULT '{
        "totalCards": 0,
        "correctCount": 0,
        "averageConfidence": 0,
        "studyStreak": 0,
        "timeSpent": 0,
        "fsrsProgress": {
            "averageStability": 0,
            "averageDifficulty": 0,
            "retentionRate": 0,
            "intervalProgress": 0
        }
    }',
    settings JSONB NOT NULL DEFAULT '{
        "sessionDuration": 30,
        "cardsPerSession": 20,
        "showConfidenceButtons": true,
        "enableFSRS": true,
        "voiceConfig": {
            "recognitionThreshold": 0.8,
            "language": "en-US",
            "useNativeSpeaker": false
        }
    }',
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_content_user_status ON public.content(user_id, status);
CREATE INDEX idx_cards_next_review ON public.cards(user_id, next_review);
CREATE INDEX idx_study_sessions_user ON public.study_sessions(user_id, start_time);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Create trigger function for user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_preferences jsonb;
    user_role_str text;
BEGIN
    -- Get role from user metadata, default to 'FREE_USER' if not found
    user_role_str := COALESCE(
        NEW.raw_user_meta_data->>'user_role',
        'FREE_USER'
    );

    -- Validate role string
    IF user_role_str NOT IN ('FREE_USER', 'PRO_USER', 'POWER_USER', 'ENTERPRISE_ADMIN', 'SYSTEM_ADMIN') THEN
        user_role_str := 'FREE_USER';
    END IF;

    -- Build default preferences
    user_preferences := jsonb_build_object(
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
    );

    INSERT INTO public.users (
        id,
        role,
        preferences,
        version,
        last_access
    )
    VALUES (
        NEW.id,
        user_role_str::public.user_role,  -- Explicitly cast to public.user_role
        user_preferences,
        1,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Set up realtime
ALTER publication supabase_realtime ADD TABLE users;
