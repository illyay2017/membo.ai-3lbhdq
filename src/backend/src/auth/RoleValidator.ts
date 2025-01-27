import { UserRole } from '../constants/userRoles';
import { createClient } from 'redis';
import { StudyModes } from '../constants/studyModes';

export class RoleValidator {
    private redisClient;

    constructor() {
        this.redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        this.redisClient.connect().catch(console.error);
    }

    async validateUserRole(userId: string): Promise<UserRole> {
        const cacheKey = `role:${userId}`;
        const cachedRole = await this.redisClient.get(cacheKey);
        
        if (cachedRole) {
            return cachedRole as UserRole;
        }

        // Default to FREE_USER if no role is found
        // In a real implementation, you would fetch this from your user service
        const role = UserRole.FREE_USER;
        
        // Cache the role for 5 minutes
        await this.redisClient.set(cacheKey, role, {
            EX: 300 // 5 minutes
        });

        return role;
    }

    async checkRateLimit(userId: string, action: 'card_generation' | 'voice_processing'): Promise<boolean> {
        const key = `ratelimit:${userId}:${action}`;
        const count = await this.redisClient.incr(key);
        
        if (count === 1) {
            await this.redisClient.expire(key, 60);
        }

        const limits = {
            card_generation: 100,
            voice_processing: 50
        } as const;

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
