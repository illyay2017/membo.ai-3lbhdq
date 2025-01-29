import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../src/constants/userRoles';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify environment variables are loaded

async function createTestUser() {
    try {
        console.log('Creating test user via Supabase...');
        
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Create auth user with metadata
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: 'test2@membo.ai',
            password: 'TestPass123!',
            email_confirm: true,
            user_metadata: {
                first_name: 'Test',
                last_name: 'User',
                user_role: 'PRO_USER'  // Pass as string
            }
        });

        if (authError) {
            console.error('Auth user creation failed:', authError);
            return false;
        }

        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the created user to verify
        const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(
            authData.user.id
        );

        if (getUserError || !user) {
            console.error('Failed to verify user:', getUserError);
            return false;
        }

        // Verify the user was created in public.users
        const { data: publicUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (dbError) {
            console.error('Failed to verify public user:', dbError);
            return false;
        }

        console.log('Successfully created user:', {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata,
            role: publicUser.role,
            preferences: publicUser.preferences
        });

        return true;
    } catch (error) {
        console.error('User creation failed:', error);
        return false;
    }
}

// Main function
async function main() {
    const success = await createTestUser();
    process.exit(success ? 0 : 1);
}

main();
