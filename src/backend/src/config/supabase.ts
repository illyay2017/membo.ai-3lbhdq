// This file can be deleted as it's replaced by SupabaseService

/**
 * @fileoverview Supabase client configuration with enhanced security and monitoring
 * @version 1.0.0
 * @license MIT
 */

import { UserRole } from '@/constants/userRoles';
import { IUserPreferences } from '@/interfaces/IUser';
import { createClient } from '@supabase/supabase-js'; // v2.39.0

// Create a simple storage implementation for auth client compatibility
const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => store.get(`_${key}`) || null,
    setItem: (key: string, value: string): void => { store.set(`_${key}`, value); },
    removeItem: (key: string): void => { store.delete(`_${key}`); },
    clear: (): void => { store.clear(); }
  };
})();

/**
 * Validates required Supabase environment variables
 * @throws {Error} If any required environment variables are missing or invalid
 */
const validateEnvironmentVariables = (): void => {
  const { 
    SUPABASE_URL, 
    SUPABASE_ANON_KEY, 
    SUPABASE_SERVICE_ROLE_KEY 
  } = process.env;

  // Add debug logging
  console.log('Supabase Environment Variables:', {
    url: SUPABASE_URL || 'missing',
    anonKey: SUPABASE_ANON_KEY ? `set (length: ${SUPABASE_ANON_KEY.length})` : 'missing',
    serviceKey: SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
    rawAnonKey: SUPABASE_ANON_KEY || 'missing' // Temporarily log the actual key for debugging
  });

  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  try {
    new URL(SUPABASE_URL);
  } catch (error) {
    throw new Error('SUPABASE_URL must be a valid URL');
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 32) {
    console.error('Invalid SUPABASE_ANON_KEY:', {
      exists: !!SUPABASE_ANON_KEY,
      length: SUPABASE_ANON_KEY?.length || 0,
      value: SUPABASE_ANON_KEY || 'missing'
    });
    throw new Error('SUPABASE_ANON_KEY must be a valid API key');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a valid service role key');
  }
};

/**
 * Creates and configures a Supabase client instance
 */
export function createSupabaseClient(useServiceRole = false) {
  const { 
    SUPABASE_URL, 
    SUPABASE_ANON_KEY, 
    SUPABASE_SERVICE_ROLE_KEY 
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  // Transform URL for Docker networking
  const supabaseUrl = SUPABASE_URL.replace('localhost', 'host.docker.internal');
  const supabaseKey = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: memoryStorage
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'membo.ai',
        'x-client-version': '1.0.0'
      }
    }
  });
}

// Create default instance for general use
export const supabaseClient = createSupabaseClient();
export const supabaseAdmin = createSupabaseClient(true);
Object.freeze(supabaseClient);
Object.freeze(supabaseAdmin);

export default supabaseClient;

// Helper for auth operations needing service role
export function getServiceClient() {
  return createSupabaseClient(true);
}

/**
 * Type-safe database interface
 * @exports
 */
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          role: UserRole;
          preferences: IUserPreferences;
          created_at: string;
          updated_at: string;
          version: number;
          last_access: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      // ... other tables
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
