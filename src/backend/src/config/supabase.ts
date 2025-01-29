/**
 * @fileoverview Supabase client configuration with enhanced security and monitoring
 * @version 1.0.0
 * @license MIT
 */

import { UserRole } from '@/constants/userRoles';
import { IUserPreferences } from '@/interfaces/IUser';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // v2.39.0

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
 * Creates and configures a Supabase client instance with enhanced security and monitoring
 * @returns {SupabaseClient} Configured Supabase client instance
 */
const createSupabaseClient = (): SupabaseClient => {
  validateEnvironmentVariables();

  // Transform URL for Docker networking
  const supabaseUrl = process.env.SUPABASE_URL!.replace(
    'localhost', 
    'host.docker.internal'
  );
  const supabaseKey = process.env.SUPABASE_ANON_KEY!;

  console.log('Creating Supabase client with transformed URL:', {
    originalUrl: process.env.SUPABASE_URL,
    transformedUrl: supabaseUrl,
    keyLength: supabaseKey?.length || 0
  });

  // Create a simple storage implementation
  const memoryStorage = (() => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string): string | null => store.get(`_${key}`) || null,
      setItem: (key: string, value: string): void => { store.set(`_${key}`, value); },
      removeItem: (key: string): void => { store.delete(`_${key}`); },
      clear: (): void => { store.clear(); }
    };
  })();

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memoryStorage
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'membo.ai',
        'x-client-version': '1.0.0',
        'x-request-timeout': '5000'
      }
    },
    realtime: {
      timeout: 30000
    }
  });

  return client;
};

/**
 * Singleton Supabase client instance with enhanced security and monitoring
 * @exports
 * @constant
 * @type {SupabaseClient}
 */
const supabase = createSupabaseClient();

// Prevent modifications to the client instance
Object.freeze(supabase);

export default supabase;

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
    Views: {
      // Add your view definitions here
    };
    Functions: {
      // Add your function definitions here
    };
    Enums: {
      // Add your enum definitions here
    };
  };
};
