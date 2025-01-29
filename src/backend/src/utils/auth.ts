import { SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '../constants/userRoles';

interface CreateUserParams {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}

export async function createUser(
    supabase: SupabaseClient,
    params: CreateUserParams
) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: {
            first_name: params.firstName,
            last_name: params.lastName,
            user_role: params.role
        }
    });

    if (authError) {
        throw new Error(`Failed to create user: ${authError.message}`);
    }

    return authData;
}
