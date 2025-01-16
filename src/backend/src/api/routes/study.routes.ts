/**
 * @fileoverview Express router configuration for study session management endpoints,
 * implementing secure, performant RESTful API routes with tiered access control,
 * request validation, and performance monitoring.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { StudyController } from '../controllers/StudyController';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { createValidationMiddleware } from '../middlewares/validation.middleware';
import { 
    createStudySessionSchema, 
    updateStudySessionSchema 
} from '../validators/study.validator';
import { UserRole } from '../../constants/userRoles';

/**
 * Configures and returns the study routes with security and performance features
 * @param studyController Initialized study controller instance
 * @returns Configured Express router
 */
const initializeStudyRoutes = (studyController: StudyController): Router => {
    const router = express.Router();

    // Configure tier-based rate limiting
    const studyRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: (req) => {
            const userRole = (req.user as any)?.role;
            switch (userRole) {
                case UserRole.POWER_USER:
                    return 1000;
                case UserRole.PRO_USER:
                    return 500;
                default:
                    return 200;
            }
        },
        message: 'Study session rate limit exceeded'
    });

    // Apply global authentication to all study routes
    router.use(authenticate);

    /**
     * POST /sessions
     * Creates a new study session with validation and rate limiting
     */
    router.post('/sessions',
        authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
        studyRateLimiter,
        createValidationMiddleware(createStudySessionSchema),
        studyController.startSession
    );

    /**
     * PUT /sessions/:id
     * Updates study session progress with validation
     */
    router.put('/sessions/:id',
        authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
        studyRateLimiter,
        createValidationMiddleware(updateStudySessionSchema),
        studyController.updateProgress
    );

    /**
     * POST /sessions/:id/voice
     * Submits voice response with pro-tier access control
     */
    router.post('/sessions/:id/voice',
        authorize([UserRole.PRO_USER, UserRole.POWER_USER]),
        studyRateLimiter,
        studyController.submitVoiceResponse
    );

    /**
     * PUT /sessions/:id/complete
     * Completes study session with performance tracking
     */
    router.put('/sessions/:id/complete',
        authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
        studyRateLimiter,
        studyController.completeSession
    );

    /**
     * GET /sessions/:id/stats
     * Retrieves study session statistics with rate limiting
     */
    router.get('/sessions/:id/stats',
        authorize([UserRole.FREE_USER, UserRole.PRO_USER, UserRole.POWER_USER]),
        studyRateLimiter,
        studyController.getSessionStatistics
    );

    return router;
};

// Export configured study routes
export default initializeStudyRoutes;