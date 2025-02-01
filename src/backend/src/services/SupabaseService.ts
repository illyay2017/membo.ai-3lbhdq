import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '../constants/userRoles';
import { IUserPreferences } from '../interfaces/IUser';

/**
 * Configuration for Supabase client
 */
const SUPABASE_CONFIG = {
  // TODO: determine what all of these mean in the context of
  // how membo is architected, considering token and session management
  // is handled in a separate service
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // flowType: 'pkce' as const,
    debug: process.env.NODE_ENV === 'development',
  },
  db: {
    schema: 'public' as const
  },
  global: {
    headers: {
      'x-application-name': 'membo.ai',
      'x-application-version': process.env.npm_package_version || '1.0.0'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
};

type Database = {
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
      };
      // ... other tables
    };
  };
};

export class SupabaseService {
  private static instance: SupabaseService;
  public readonly client: SupabaseClient<Database, 'public'>;
  private readonly serviceClient: SupabaseClient<Database, 'public'>;

  private constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration. Please check environment variables.');
    }

    // Transform URL for Docker networking
    const supabaseUrl = process.env.SUPABASE_URL.replace('localhost', 'host.docker.internal');
    console.log('Using Supabase URL:', supabaseUrl);

    // Regular client for app operations
    this.client = createClient<Database, 'public'>(
      supabaseUrl,
      process.env.SUPABASE_ANON_KEY,
      SUPABASE_CONFIG
    );

    console.log('Supabase client created:', this.client);
    console.log(this.client);

    // Service role client for admin/DB operations
    this.serviceClient = createClient<Database, 'public'>(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_CONFIG
    );

    // Setup error handling
    this.client.auth.onAuthStateChange((event, session) => {
      console.log('Supabase auth state changed:', event, session?.user?.id);
    });
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Get service role client for admin/DB operations
   */
  public getServiceClient(): SupabaseClient<Database, 'public'> {
    return this.serviceClient;
  }

  /**
   * Verify database connection and configuration
   */
  public async verifyConnection(): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('health_check')
        .select('version')
        .single();

      if (error) throw error;
      console.log('Supabase connection verified:', data?.version);
    } catch (error) {
      console.error('Failed to verify Supabase connection:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources and subscriptions
   */
  public async cleanup(): Promise<void> {
    try {
      await this.client.auth.signOut();
      await this.client.removeAllChannels();
    } catch (error) {
      console.error('Supabase cleanup error:', error);
    }
  }
}
