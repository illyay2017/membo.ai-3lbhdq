// @types/node version: ^20.0.0
import 'node';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * Application environment mode
       * @required
       */
      NODE_ENV: 'development' | 'staging' | 'production';

      /**
       * Server port number
       * @required
       */
      PORT: string;

      /**
       * Database connection string
       * @required
       * @security sensitive
       */
      DATABASE_URL: string;

      /**
       * Redis connection string
       * @required
       * @security sensitive
       */
      REDIS_URL: string;

      /**
       * JWT signing secret
       * @required
       * @security critical
       */
      JWT_SECRET: string;

      /**
       * JWT token expiry duration
       * @required
       */
      JWT_EXPIRY: string;

      /**
       * JWT refresh token secret
       * @required
       * @security critical
       */
      JWT_REFRESH_SECRET: string;

      /**
       * JWT refresh token expiry duration
       * @required
       */
      JWT_REFRESH_EXPIRY: string;

      /**
       * OpenAI API key
       * @required
       * @security critical
       */
      OPENAI_API_KEY: string;

      /**
       * OpenAI organization ID
       * @required
       * @security sensitive
       */
      OPENAI_ORG_ID: string;

      /**
       * OpenAI model version identifier
       * @required
       */
      OPENAI_MODEL_VERSION: string;

      /**
       * OpenAI API request timeout in milliseconds
       * @required
       */
      OPENAI_REQUEST_TIMEOUT: string;

      /**
       * Supabase project URL
       * @required
       * @security sensitive
       */
      SUPABASE_URL: string;

      /**
       * Supabase anonymous key
       * @required
       * @security sensitive
       */
      SUPABASE_ANON_KEY: string;

      /**
       * Supabase service role key
       * @required
       * @security critical
       */
      SUPABASE_SERVICE_ROLE_KEY: string;

      /**
       * Redis cache TTL in seconds
       * @required
       */
      REDIS_TTL: string;

      /**
       * Redis maximum memory allocation
       * @required
       */
      REDIS_MAX_MEMORY: string;

      /**
       * Redis cache eviction policy
       * @required
       */
      REDIS_EVICTION_POLICY: string;

      /**
       * Rate limiting window duration in seconds
       * @required
       */
      RATE_LIMIT_WINDOW: string;

      /**
       * Maximum requests per rate limit window
       * @required
       */
      RATE_LIMIT_MAX_REQUESTS: string;

      /**
       * Rate limit for free tier users
       * @required
       */
      RATE_LIMIT_FREE_TIER: string;

      /**
       * Rate limit for pro tier users
       * @required
       */
      RATE_LIMIT_PRO_TIER: string;

      /**
       * Application logging level
       * @required
       */
      LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';

      /**
       * Log output format
       * @required
       */
      LOG_FORMAT: 'json' | 'pretty';

      /**
       * Sentry DSN for error tracking
       * @required
       * @security sensitive
       */
      SENTRY_DSN: string;

      /**
       * Sentry environment identifier
       * @required
       */
      SENTRY_ENVIRONMENT: string;

      /**
       * CORS allowed origins
       * @required
       */
      CORS_ORIGIN: string;

      /**
       * CORS allowed methods
       * @required
       */
      CORS_METHODS: string;

      /**
       * API version identifier
       * @required
       */
      API_VERSION: string;

      /**
       * Maintenance mode flag
       * @required
       */
      MAINTENANCE_MODE: string;
    }
  }
}

export {};