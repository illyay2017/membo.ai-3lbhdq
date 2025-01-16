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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    encrypted_password TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'FREE_USER',
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE SET NULL,
    front_content JSONB NOT NULL,
    back_content JSONB NOT NULL,
    fsrs_data JSONB NOT NULL DEFAULT '{"stability": 0, "difficulty": 0}',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    review_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT valid_fsrs_data CHECK (
        jsonb_typeof(fsrs_data->'stability') = 'number' AND
        jsonb_typeof(fsrs_data->'difficulty') = 'number'
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
CREATE INDEX idx_users_email ON users(email);
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