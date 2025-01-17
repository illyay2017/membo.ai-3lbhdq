/**
 * @fileoverview Supabase client configuration with enhanced security and monitoring
 * @version 1.0.0
 * @license MIT
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'; // v2.39.0

/**
 * Validates required Supabase environment variables
 * @throws {Error} If any required environment variables are missing or invalid
 */
const validateEnvironmentVariables = (): void => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  try {
    new URL(SUPABASE_URL);
  } catch (error) {
    throw new Error('SUPABASE_URL must be a valid URL');
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 32) {
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

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        type: 'localStorage',
        keyPrefix: 'membo_'
      }
    },
    db: {
      schema: 'public',
      // Configure connection pooling based on technical specifications
      pooling: {
        max: 10,
        idleTimeoutMillis: 30000
      }
    },
    global: {
      // Enhanced security headers
      headers: {
        'x-application-name': 'membo.ai',
        'x-client-version': '1.0.0',
        'x-request-timeout': '5000'
      },
      // Retry configuration for resilience
      retryOptions: {
        maxRetries: 3,
        retryDelay: 1000
      }
    },
    // Real-time subscription settings
    realtime: {
      timeout: 30000,
      heartbeat: {
        interval: 15000,
        timeout: 5000
      }
    }
  });

  // Add error monitoring hooks
  client.handleError = (error: Error) => {
    console.error('[Supabase Error]:', error);
    // Additional error tracking could be implemented here
  };

  // Add performance monitoring
  client.handleResponse = (response: Response) => {
    if (!response.ok) {
      console.warn('[Supabase Response]:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });
    }
  };

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
      // Add your table definitions here
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