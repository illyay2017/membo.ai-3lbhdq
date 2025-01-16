-- Development seed data for membo.ai
-- Version: 1.0.0

-- Global constants
\set DEFAULT_PASSWORD_HASH '''$2b$10$DEV_ENVIRONMENT_HASH'''

-- Clean existing data
TRUNCATE users, content, cards, study_sessions, study_metrics, performance_analytics, engagement_metrics CASCADE;

-- Seed Users
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    preferences,
    is_email_verified,
    created_at
) VALUES 
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'free@membo.ai',
    :DEFAULT_PASSWORD_HASH,
    'Free',
    'User',
    'FREE_USER',
    '{"studyMode": "STANDARD", "voiceEnabled": false, "dailyGoal": 20, "emailNotifications": true, "theme": "light", "language": "en"}'::jsonb,
    true,
    NOW() - INTERVAL '30 days'
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    'pro@membo.ai',
    :DEFAULT_PASSWORD_HASH,
    'Pro',
    'User',
    'PRO_USER',
    '{"studyMode": "VOICE", "voiceEnabled": true, "dailyGoal": 50, "emailNotifications": true, "theme": "dark", "language": "es"}'::jsonb,
    true,
    NOW() - INTERVAL '60 days'
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    'power@membo.ai',
    :DEFAULT_PASSWORD_HASH,
    'Power',
    'User',
    'POWER_USER',
    '{"studyMode": "QUIZ", "voiceEnabled": true, "dailyGoal": 100, "emailNotifications": false, "theme": "system", "language": "fr"}'::jsonb,
    true,
    NOW() - INTERVAL '90 days'
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d482',
    'admin@membo.ai',
    :DEFAULT_PASSWORD_HASH,
    'System',
    'Admin',
    'SYSTEM_ADMIN',
    '{"studyMode": "STANDARD", "voiceEnabled": true, "dailyGoal": 30, "emailNotifications": true, "theme": "light", "language": "en"}'::jsonb,
    true,
    NOW() - INTERVAL '120 days'
);

-- Seed Content
INSERT INTO content (
    id,
    user_id,
    content,
    metadata,
    status,
    created_at,
    processed_at
) VALUES
(
    'c47ac10b-58cc-4372-a567-0e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'The mitochondria is the powerhouse of the cell. This organelle generates most of the cell''s supply of adenosine triphosphate (ATP).',
    '{"source": "web", "url": "example.com/biology", "captureDate": "2023-01-01T10:00:00Z", "title": "Cell Biology Basics", "tags": ["biology", "science"]}'::jsonb,
    'NEW',
    NOW() - INTERVAL '25 days',
    NULL
),
(
    'c47ac10b-58cc-4372-a567-0e02b2c3d480',
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    'Design patterns are reusable solutions to commonly occurring problems in software design.',
    '{"source": "pdf", "title": "Software Design Patterns", "pageNumbers": [12, 13, 14], "author": "Gang of Four", "tags": ["programming", "design"]}'::jsonb,
    'PROCESSED',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '19 days'
),
(
    'c47ac10b-58cc-4372-a567-0e02b2c3d481',
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    'La boulangerie est ouverte tous les jours de la semaine.',
    '{"source": "kindle", "book": "French for Beginners", "location": "1234-1256", "tags": ["french", "language"]}'::jsonb,
    'PROCESSED',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '14 days'
);

-- Seed Cards
INSERT INTO cards (
    id,
    user_id,
    content_id,
    front_content,
    back_content,
    fsrs_data,
    next_review,
    created_at
) VALUES
(
    'd47ac10b-58cc-4372-a567-0e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'c47ac10b-58cc-4372-a567-0e02b2c3d479',
    '{"text": "What is the main function of mitochondria?"}'::jsonb,
    '{"text": "The mitochondria generates most of the cell''s supply of ATP (adenosine triphosphate)."}'::jsonb,
    '{"stability": 0.5, "difficulty": 0.3, "retrievability": 0.9, "review_count": 5, "last_review": "2023-01-05T10:00:00Z"}'::jsonb,
    NOW() + INTERVAL '1 day',
    NOW() - INTERVAL '24 days'
),
(
    'd47ac10b-58cc-4372-a567-0e02b2c3d480',
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    'c47ac10b-58cc-4372-a567-0e02b2c3d480',
    '{"text": "What are design patterns in software development?"}'::jsonb,
    '{"text": "Design patterns are reusable solutions to commonly occurring problems in software design."}'::jsonb,
    '{"stability": 15.7, "difficulty": 0.1, "retrievability": 0.95, "review_count": 10, "last_review": "2023-01-10T15:00:00Z"}'::jsonb,
    NOW() + INTERVAL '15 days',
    NOW() - INTERVAL '19 days'
),
(
    'd47ac10b-58cc-4372-a567-0e02b2c3d481',
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    'c47ac10b-58cc-4372-a567-0e02b2c3d481',
    '{"text": "Comment dit-on \"The bakery is open every day of the week\" en français?"}'::jsonb,
    '{"text": "La boulangerie est ouverte tous les jours de la semaine."}'::jsonb,
    '{"stability": 8.3, "difficulty": 0.2, "retrievability": 0.87, "review_count": 7, "last_review": "2023-01-15T09:00:00Z"}'::jsonb,
    NOW() + INTERVAL '8 days',
    NOW() - INTERVAL '14 days'
);

-- Seed Study Sessions
INSERT INTO study_sessions (
    id,
    user_id,
    mode,
    start_time,
    end_time,
    performance,
    cards_studied
) VALUES
(
    's47ac10b-58cc-4372-a567-0e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'STANDARD',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days' + INTERVAL '30 minutes',
    '{"correct": 8, "incorrect": 2, "skipped": 1, "average_response_time": 3.5}'::jsonb,
    11
),
(
    's47ac10b-58cc-4372-a567-0e02b2c3d480',
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    'VOICE',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days' + INTERVAL '45 minutes',
    '{"correct": 15, "incorrect": 5, "skipped": 0, "average_response_time": 5.2, "voice_accuracy": 0.92}'::jsonb,
    20
),
(
    's47ac10b-58cc-4372-a567-0e02b2c3d481',
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    'QUIZ',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '60 minutes',
    '{"correct": 25, "incorrect": 3, "skipped": 2, "average_response_time": 4.1, "quiz_score": 0.89}'::jsonb,
    30
);

-- Seed Analytics Data
-- Study Metrics
INSERT INTO study_metrics (
    user_id,
    date,
    total_study_time,
    cards_studied,
    retention_rate
) VALUES
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    CURRENT_DATE - INTERVAL '7 days',
    3600, -- 1 hour in seconds
    30,
    0.85
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    CURRENT_DATE - INTERVAL '7 days',
    7200, -- 2 hours in seconds
    60,
    0.92
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    CURRENT_DATE - INTERVAL '7 days',
    10800, -- 3 hours in seconds
    90,
    0.88
);

-- Performance Analytics
INSERT INTO performance_analytics (
    user_id,
    session_id,
    study_mode,
    average_confidence
) VALUES
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    's47ac10b-58cc-4372-a567-0e02b2c3d479',
    'STANDARD',
    0.75
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    's47ac10b-58cc-4372-a567-0e02b2c3d480',
    'VOICE',
    0.85
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    's47ac10b-58cc-4372-a567-0e02b2c3d481',
    'QUIZ',
    0.92
);

-- Engagement Metrics
INSERT INTO engagement_metrics (
    user_id,
    week_start_date,
    active_days,
    total_sessions
) VALUES
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week',
    5,
    10
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week',
    6,
    15
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week',
    7,
    21
);