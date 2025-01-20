-- Development seed data for membo.ai
-- Version: 1.0.0

-- Clean existing data
TRUNCATE content, cards, study_sessions, study_metrics, performance_analytics, engagement_metrics CASCADE;

-- Seed Users
DO $$
DECLARE
    default_password_hash TEXT := '$2b$10$DEV_ENVIRONMENT_HASH';
BEGIN
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data
    ) VALUES 
    (
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'free@membo.ai',
        default_password_hash,
        NOW(),
        NOW() - INTERVAL '30 days',
        NOW(),
        jsonb_build_object(
            'role', 'FREE_USER',
            'preferences', jsonb_build_object(
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
        ),
        jsonb_build_object(
            'first_name', 'Free',
            'last_name', 'User'
        )
    ),
    (
        'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        'pro@membo.ai',
        default_password_hash,
        NOW(),
        NOW() - INTERVAL '60 days',
        NOW(),
        jsonb_build_object(
            'role', 'PRO_USER',
            'preferences', jsonb_build_object(
                'studyMode', 'ADVANCED',
                'voiceEnabled', true,
                'dailyGoal', 50,
                'theme', 'dark',
                'language', 'es',
                'notifications', jsonb_build_object(
                    'email', true,
                    'push', true,
                    'studyReminders', true
                )
            )
        ),
        jsonb_build_object(
            'first_name', 'Pro',
            'last_name', 'User'
        )
    ),
    (
        'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        'power@membo.ai',
        default_password_hash,
        NOW(),
        NOW() - INTERVAL '90 days',
        NOW(),
        jsonb_build_object(
            'role', 'POWER_USER',
            'preferences', jsonb_build_object(
                'studyMode', 'EXPERT',
                'voiceEnabled', true,
                'dailyGoal', 100,
                'theme', 'system',
                'language', 'fr',
                'notifications', jsonb_build_object(
                    'email', true,
                    'push', true,
                    'studyReminders', true
                )
            )
        ),
        jsonb_build_object(
            'first_name', 'Power',
            'last_name', 'User'
        )
    ),
    (
        'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        'admin@membo.ai',
        default_password_hash,
        NOW(),
        NOW() - INTERVAL '120 days',
        NOW(),
        jsonb_build_object(
            'role', 'SYSTEM_ADMIN',
            'preferences', jsonb_build_object(
                'studyMode', 'STANDARD',
                'voiceEnabled', true,
                'dailyGoal', 30,
                'theme', 'light',
                'language', 'en'
            )
        ),
        jsonb_build_object(
            'first_name', 'System',
            'last_name', 'Admin'
        )
    );
END $$;

-- Seed Content
INSERT INTO content (
    id,
    user_id,
    content,
    metadata,
    status,
    captured_at,
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
    '847ac10b-58cc-4372-a567-0e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'STANDARD',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days' + INTERVAL '30 minutes',
    '{"correct": 8, "incorrect": 2, "skipped": 1, "average_response_time": 3.5}'::jsonb,
    ARRAY['d47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid]
),
(
    '857ac10b-58cc-4372-a567-0e02b2c3d480',
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    'VOICE',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days' + INTERVAL '45 minutes',
    '{"correct": 15, "incorrect": 5, "skipped": 0, "average_response_time": 5.2, "voice_accuracy": 0.92}'::jsonb,
    ARRAY['d47ac10b-58cc-4372-a567-0e02b2c3d480'::uuid]
),
(
    '867ac10b-58cc-4372-a567-0e02b2c3d481',
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    'QUIZ',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '60 minutes',
    '{"correct": 25, "incorrect": 3, "skipped": 2, "average_response_time": 4.1, "quiz_score": 0.89}'::jsonb,
    ARRAY['d47ac10b-58cc-4372-a567-0e02b2c3d481'::uuid]
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
    INTERVAL '1 hour',
    30,
    0.85
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    CURRENT_DATE - INTERVAL '7 days',
    INTERVAL '2 hours',
    60,
    0.92
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    CURRENT_DATE - INTERVAL '7 days',
    INTERVAL '3 hours',
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
    '847ac10b-58cc-4372-a567-0e02b2c3d479',
    'STANDARD',
    0.75
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    '857ac10b-58cc-4372-a567-0e02b2c3d480',
    'VOICE',
    0.85
),
(
    'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    '867ac10b-58cc-4372-a567-0e02b2c3d481',
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
