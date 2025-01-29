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
            'providers', ARRAY['email'],
            'role', role::text,
            'preferences', preferences
        ),
        metadata,
        now(),
        now(),
        role = 'SYSTEM_ADMIN'
    );

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean existing data
TRUNCATE auth.users CASCADE;
TRUNCATE content, cards, study_sessions, study_metrics, performance_analytics, engagement_metrics CASCADE;

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
    INSERT INTO content (
        id,
        user_id,
        content,
        metadata,
        status,
        captured_at,
        processed_at
    ) VALUES (
        'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        free_user_id,  -- Use the stored user ID
        'The mitochondria is the powerhouse of the cell. This organelle generates most of the cell''s supply of adenosine triphosphate (ATP).',
        '{"source": "web", "url": "example.com/biology", "captureDate": "2023-01-01T10:00:00Z", "title": "Cell Biology Basics", "tags": ["biology", "science"]}'::jsonb,
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

-- Commit transaction
COMMIT;
