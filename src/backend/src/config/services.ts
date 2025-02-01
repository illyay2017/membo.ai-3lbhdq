import { IRedisService } from '../interfaces/services';
import { RedisService } from '../services/RedisService';
import { TokenService } from '../services/TokenService';
import { AuthService } from '../services/AuthService';
import { RateLimiterService } from '../services/RateLimiterService';
import { SupabaseService } from '../services/SupabaseService';

export interface ServiceContainer {
  authService: AuthService;
  tokenService: TokenService;
  rateLimiterService: RateLimiterService;
  redisService: IRedisService;
  supabaseService: SupabaseService;
}

let services: ServiceContainer | null = null;

export function getServices(): ServiceContainer {
  if (!services) {
    // Get singleton instances
    const redisService = RedisService.getInstance();
    const supabaseService = SupabaseService.getInstance();
    
    // Initialize dependent services
    const tokenService = new TokenService(redisService);
    const rateLimiterService = new RateLimiterService(redisService);
    const authService = new AuthService(supabaseService.client, tokenService, redisService);

    services = {
      authService,
      tokenService,
      rateLimiterService,
      redisService,
      supabaseService
    };
  }

  return services;
}

// For testing purposes
export function resetServices(): void {
  services = null;
}
