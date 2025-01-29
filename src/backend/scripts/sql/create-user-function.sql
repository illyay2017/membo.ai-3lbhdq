-- Enable the pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the function
CREATE OR REPLACE FUNCTION auth.create_user(
    email text,
    password text,
    role text,
    metadata jsonb DEFAULT '{}'::jsonb,
    preferences jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
    user_id uuid;
    encrypted_pw text;
BEGIN
    user_id := gen_random_uuid();
    encrypted_pw := crypt(password, gen_salt('bf'));
    
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
        updated_at
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
            'role', role,
            'preferences', preferences
        ),
        metadata,
        now(),
        now()
    );

    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        created_at,
        updated_at
    ) VALUES (
        user_id,
        user_id,
        user_id,
        jsonb_build_object(
            'sub', user_id::text,
            'email', email
        ),
        'email',
        now(),
        now()
    );

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
