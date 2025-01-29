import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../src/constants/userRoles';

dotenv.config();

// Add more detailed environment logging
console.log('Environment check:', {
  url: process.env.SUPABASE_URL,  // Log the full URL
  serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
  urlMatch: process.env.SUPABASE_URL === 'http://localhost:54321',  // Updated URL
  serviceKeyMatch: process.env.SUPABASE_SERVICE_ROLE_KEY === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
});

const SEED_USERS = [
  {
    email: 'free@membo.ai',
    password: 'TestPass123!',
    role: UserRole.FREE_USER,
    preferences: { theme: 'light', language: 'en' },
    metadata: {
      first_name: 'Free',
      last_name: 'User'
    }
  },
  {
    email: 'pro@membo.ai',
    password: 'TestPass123!',
    role: UserRole.PRO_USER,
    preferences: { theme: 'dark', language: 'es' },
    metadata: {
      first_name: 'Pro',
      last_name: 'User'
    }
  },
  {
    email: 'admin@membo.ai',
    password: 'TestPass123!',
    role: UserRole.SYSTEM_ADMIN,
    preferences: { theme: 'system', language: 'en' },
    metadata: {
      first_name: 'System',
      last_name: 'Admin'
    }
  }
] as const;

// First create a function to handle user creation
const createUserSQL = `
CREATE OR REPLACE FUNCTION public.create_user(
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
    encrypted_pw := extensions.crypt(password, extensions.gen_salt('bf'));
    
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
`;

async function seedUsers() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!.replace(/\/$/, ''),
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First create the function
    const { error: fnError } = await supabase.rpc('create_user_function', {
      sql: createUserSQL
    });

    if (fnError) {
      console.error('Failed to create function:', fnError);
      throw fnError;
    }

    console.log('Starting user seeding...');

    for (const seedUser of SEED_USERS) {
      try {
        const { data, error } = await supabase.rpc('create_user', {
          email: seedUser.email,
          password: seedUser.password,
          role: seedUser.role,
          metadata: seedUser.metadata,
          preferences: seedUser.preferences
        });

        if (error) {
          if (error.message.includes('unique constraint')) {
            console.log(`User ${seedUser.email} already exists, skipping...`);
            continue;
          }
          throw error;
        }

        console.log(`Created user: ${seedUser.email}`, { userId: data });
      } catch (error) {
        console.error(`Failed to create user ${seedUser.email}:`, error);
        throw error;
      }
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedUsers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
