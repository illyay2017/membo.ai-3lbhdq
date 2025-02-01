import { UserRole } from '../constants/userRoles';
import { getServices } from '../config/services';
import { RedisService } from '../services/RedisService';
import { StudyModes } from '../constants/studyModes';

export class RoleValidator {
    private readonly redisService: RedisService;
    private readonly CACHE_DURATION = 300; // 5 minutes in seconds

    constructor() {
        this.redisService = getServices().redisService;
    }

    async validateUserRole(userId: string): Promise<UserRole> {
        const cacheKey = `${this.redisService.PREFIX.ROLE_CACHE}${userId}`;
        const cachedRole = await this.redisService.getCachedRole(userId);
        
        if (cachedRole) {
            return cachedRole as UserRole;
        }

        // Default to FREE_USER if no role is found
        // In a real implementation, you would fetch this from your user service
        const role = UserRole.FREE_USER;
        
        // Cache the role for 5 minutes
        await this.redisService.set(cacheKey, role, {
            EX: this.CACHE_DURATION
        });

        return role;
    }

    async checkRateLimit(userId: string, action: 'card_generation' | 'voice_processing'): Promise<boolean> {
        const key = `${userId}:${action}`;
        const windowMs = 60 * 1000; // 1 minute in milliseconds
        
        const limits = {
            card_generation: 100,
            voice_processing: 50
        } as const;

        const count = await this.redisService.incrementRateLimit(key, windowMs);
        return count <= (limits[action] || 30);
    }

    canAccessStudyMode(role: UserRole, mode: StudyModes): boolean {
        const modeAccess = {
            [UserRole.FREE_USER]: [StudyModes.STANDARD],
            [UserRole.PRO_USER]: [StudyModes.STANDARD, StudyModes.VOICE],
            [UserRole.POWER_USER]: [StudyModes.STANDARD, StudyModes.VOICE, StudyModes.QUIZ],
            [UserRole.ENTERPRISE_ADMIN]: Object.values(StudyModes),
            [UserRole.SYSTEM_ADMIN]: Object.values(StudyModes)
        };

        return modeAccess[role]?.includes(mode) || false;
    }
}
