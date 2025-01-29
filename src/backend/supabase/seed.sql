-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Start transaction
BEGIN;

-- Create user role type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('FREE_USER', 'PRO_USER', 'POWER_USER', 'SYSTEM_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to create users with proper password hashing
CREATE OR REPLACE FUNCTION create_seed_user(
    email text,
    password text,
    role user_role,
    metadata jsonb DEFAULT '{}'::jsonb,
    preferences jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
    user_id uuid;
    encrypted_pw text;
BEGIN
    -- Add logging
    RAISE NOTICE 'Creating user with email: %', email;
    
    user_id := gen_random_uuid();
    encrypted_pw := crypt(password, gen_salt('bf'));
    
    -- First create the user in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        user_id,
        'authenticated',
        'authenticated',
        email,
        encrypted_pw,
        now(),
        jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email']
        ),
        jsonb_build_object(
            'first_name', metadata->>'first_name',
            'last_name', metadata->>'last_name',
            'user_role', role::text
        ),
        now(),
        now(),
        role = 'SYSTEM_ADMIN'
    );

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean existing data
TRUNCATE auth.users CASCADE;
TRUNCATE public.content, public.cards, public.study_sessions CASCADE;

-- Only truncate analytics tables if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'study_analytics') THEN
        EXECUTE 'TRUNCATE public.study_analytics CASCADE';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'engagement_metrics') THEN
        EXECUTE 'TRUNCATE public.engagement_metrics CASCADE';
    END IF;
END $$;

-- Seed Users
DO $$ 
DECLARE
    free_user_id uuid;
    pro_user_id uuid;
    admin_user_id uuid;
BEGIN
    -- Create users and store their IDs
    SELECT create_seed_user(
        'free@membo.ai'::text,
        'TestPass123!'::text,
        'FREE_USER'::user_role,
        '{"first_name": "Free", "last_name": "User"}'::jsonb,
        '{"theme": "light", "language": "en"}'::jsonb
    ) INTO free_user_id;

    SELECT create_seed_user(
        'pro@membo.ai'::text,
        'TestPass123!'::text,
        'PRO_USER'::user_role,
        '{"first_name": "Pro", "last_name": "User"}'::jsonb,
        '{"theme": "dark", "language": "es"}'::jsonb
    ) INTO pro_user_id;

    SELECT create_seed_user(
        'admin@membo.ai'::text,
        'TestPass123!'::text,
        'SYSTEM_ADMIN'::user_role,
        '{"first_name": "System", "last_name": "Admin"}'::jsonb,
        '{"theme": "system", "language": "en"}'::jsonb
    ) INTO admin_user_id;

    -- Seed Content
    INSERT INTO public.content (
        id,
        user_id,
        content,
        metadata,
        source_type,
        source_url,
        status,
        captured_at,
        processed_at
    ) VALUES (
        'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        free_user_id,
        'The mitochondria is the powerhouse of the cell. This organelle generates most of the cell''s supply of adenosine triphosphate (ATP).',
        '{
            "title": "Cell Biology Basics",
            "author": "Biology Expert",
            "tags": ["biology", "science"],
            "language": "en"
        }'::jsonb,
        'web',
        'example.com/biology',
        'NEW',
        NOW() - INTERVAL '25 days',
        NULL
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
        compatible_modes,
        tags,
        created_at
    ) VALUES (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        free_user_id,
        'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        '{"text": "What is the powerhouse of the cell?"}'::jsonb,
        '{"text": "Mitochondria"}'::jsonb,
        '{
            "stability": 0.4,
            "difficulty": 0.2,
            "reviewCount": 0,
            "lastReview": null,
            "lastRating": 0
        }'::jsonb,
        NOW() + INTERVAL '1 day',
        ARRAY['STANDARD']::text[],
        ARRAY['biology', 'science']::text[],
        NOW()
    );
END $$;

-- Drop the temporary function
DROP FUNCTION create_seed_user(text, text, user_role, jsonb, jsonb);

-- Seed test user (if not exists)
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    'test@membo.ai',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    jsonb_build_object(
        'first_name', 'Test',
        'last_name', 'User',
        'user_role', 'FREE_USER'
    ),
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'test@membo.ai'
);

-- Seed test content
INSERT INTO public.content (
    id,
    user_id,
    content,
    metadata,
    source_type,
    source_url,
    status,
    captured_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'The quick brown fox jumps over the lazy dog.',
    '{
        "title": "Test Article",
        "author": "Test Author",
        "tags": ["test", "example"],
        "language": "en"
    }'::jsonb,
    'web',
    'https://example.com/test',
    'PROCESSED',
    now()
);

-- Seed test cards
INSERT INTO public.cards (
    id,
    user_id,
    content_id,
    front_content,
    back_content,
    fsrs_data,
    next_review,
    compatible_modes,
    tags
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    '{
        "text": "What animal jumps over the lazy dog?",
        "type": "text"
    }'::jsonb,
    '{
        "text": "The quick brown fox",
        "type": "text"
    }'::jsonb,
    '{
        "stability": 0.5,
        "difficulty": 0.3,
        "reviewCount": 0,
        "lastReview": null,
        "lastRating": 0,
        "performanceHistory": []
    }'::jsonb,
    now(),
    ARRAY['STANDARD', 'QUIZ'],
    ARRAY['test', 'example']
);

-- Seed test study session
INSERT INTO public.study_sessions (
    id,
    user_id,
    mode,
    cards_studied,
    status,
    performance,
    settings,
    start_time,
    end_time
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'STANDARD',
    ARRAY['22222222-2222-2222-2222-222222222222']::uuid[],
    'completed',
    '{
        "totalCards": 1,
        "correctCount": 1,
        "averageConfidence": 0.8,
        "studyStreak": 1,
        "timeSpent": 300,
        "fsrsProgress": {
            "averageStability": 0.5,
            "averageDifficulty": 0.3,
            "retentionRate": 1.0,
            "intervalProgress": 0.1
        }
    }'::jsonb,
    '{
        "sessionDuration": 30,
        "cardsPerSession": 20,
        "showConfidenceButtons": true,
        "enableFSRS": true,
        "voiceConfig": {
            "recognitionThreshold": 0.8,
            "language": "en-US",
            "useNativeSpeaker": false
        }
    }'::jsonb,
    now() - interval '5 minutes',
    now()
);

-- Commit transaction
COMMIT;
