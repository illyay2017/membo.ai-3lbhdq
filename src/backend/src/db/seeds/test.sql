-- Clean up existing test data
TRUNCATE users, content, cards, study_sessions, study_metrics, performance_analytics CASCADE;

-- Test password hash for all test users
DO $$
BEGIN
    -- Seed test users with fixed UUIDs and roles
    INSERT INTO users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        preferences,
        is_email_verified,
        created_at,
        updated_at
    ) VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'free_user@test.com',
        '$2b$10$TEST_ENVIRONMENT_HASH',
        'Free',
        'User',
        'FREE_USER',
        '{"studyMode": "STANDARD", "voiceEnabled": false, "dailyGoal": 10}'::jsonb,
        true,
        NOW(),
        NOW()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'pro_user@test.com',
        '$2b$10$TEST_ENVIRONMENT_HASH',
        'Pro',
        'User',
        'PRO_USER',
        '{"studyMode": "VOICE", "voiceEnabled": true, "dailyGoal": 20}'::jsonb,
        true,
        NOW(),
        NOW()
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'admin@test.com',
        '$2b$10$TEST_ENVIRONMENT_HASH',
        'System',
        'Admin',
        'SYSTEM_ADMIN',
        '{"studyMode": "QUIZ", "voiceEnabled": true, "dailyGoal": 30}'::jsonb,
        true,
        NOW(),
        NOW()
    );

    -- Seed test content with fixed UUIDs
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
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Test content for free user',
        '{"source": "test_web", "url": "test.example.com/article"}'::jsonb,
        'NEW',
        NOW(),
        NULL
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '22222222-2222-2222-2222-222222222222',
        'Test content for pro user',
        '{"source": "test_pdf", "title": "Test Material"}'::jsonb,
        'PROCESSED',
        NOW(),
        NOW()
    );

    -- Seed test cards with fixed UUIDs
    INSERT INTO cards (
        id,
        user_id,
        content_id,
        front_content,
        back_content,
        fsrs_data,
        next_review,
        created_at,
        updated_at
    ) VALUES 
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '{"text": "What is the capital of France?"}'::jsonb,
        '{"text": "Paris"}'::jsonb,
        '{"stability": 0.4, "difficulty": 0.2}'::jsonb,
        NOW() + INTERVAL '1 day',
        NOW(),
        NOW()
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccd',
        '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '{"text": "What is the powerhouse of the cell?"}'::jsonb,
        '{"text": "Mitochondria"}'::jsonb,
        '{"stability": 0.6, "difficulty": 0.3}'::jsonb,
        NOW() + INTERVAL '2 days',
        NOW(),
        NOW()
    );

    -- Seed test study sessions with fixed UUIDs
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
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '11111111-1111-1111-1111-111111111111',
        'STANDARD',
        NOW() - INTERVAL '1 hour',
        NOW(),
        '{"correct": 5, "incorrect": 1}'::jsonb,
        6
    ),
    (
        'dddddddd-dddd-dddd-dddd-ddddddddddde',
        '22222222-2222-2222-2222-222222222222',
        'VOICE',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour',
        '{"correct": 8, "incorrect": 2}'::jsonb,
        10
    );

    -- Seed test analytics data
    INSERT INTO study_metrics (
        user_id,
        date,
        total_study_time,
        cards_studied,
        retention_rate
    ) VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        CURRENT_DATE,
        3600, -- 1 hour in seconds
        6,
        0.83 -- 83% retention rate
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        CURRENT_DATE,
        7200, -- 2 hours in seconds
        10,
        0.80 -- 80% retention rate
    );

    INSERT INTO performance_analytics (
        user_id,
        session_id,
        study_mode,
        average_confidence
    ) VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'STANDARD',
        0.75
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'dddddddd-dddd-dddd-dddd-ddddddddddde',
        'VOICE',
        0.70
    );

END $$;