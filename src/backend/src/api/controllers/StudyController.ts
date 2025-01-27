/**
 * @fileoverview Controller layer implementation for managing study sessions with enhanced
 * performance monitoring, tier-specific validations, and comprehensive error handling.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PerformanceMonitor } from 'performance-monitor';
import { StudyService } from '../../services/StudyService';
import { createStudySessionSchema, updateStudySessionSchema, validateStudyMode } from '../validators/study.validator';
import { StudyModes } from '../../constants/studyModes';
import { performanceMonitor } from '../../core/monitoring/PerformanceMonitor';

/**
 * Controller handling HTTP requests for study session management with comprehensive
 * performance monitoring and tier-specific validations
 */
export class StudyController {
    private readonly studyService: StudyService;
    private readonly performanceMonitor: PerformanceMonitor;
    private readonly rateLimiter: any;

    constructor(
        studyService: StudyService,
        performanceMonitor: PerformanceMonitor
    ) {
        this.studyService = studyService;
        this.performanceMonitor = performanceMonitor;

        // Configure rate limiting per user tier
        this.rateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: (req: Request) => {
                const userTier = (req.user as any)?.tier || 'free';
                return userTier === 'power' ? 1000 : 
                       userTier === 'pro' ? 500 : 200;
            },
            message: 'Rate limit exceeded. Please try again later.'
        });
    }

    /**
     * Starts a new study session with comprehensive validation and performance monitoring
     */
    public startSession = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const perfMetrics = this.performanceMonitor.start('startSession');
        
        try {
            // Validate request body
            const { error, value } = createStudySessionSchema.validate(req.body);
            if (error) {
                throw new Error(`Invalid request data: ${error.message}`);
            }

            // Validate study mode against user tier
            const userTier = (req.user as any)?.tier || 'free';
            if (!validateStudyMode(value.mode, { type: userTier })) {
                throw new Error(`Study mode ${value.mode} not available for your subscription tier`);
            }

            // Extract user ID from authenticated request
            const userId = (req.user as any)?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Start study session
            const session = await this.studyService.startStudySession(
                userId,
                value.mode,
                value.settings
            );

            // Record performance metrics
            perfMetrics.end({
                userId,
                mode: value.mode,
                success: true
            });

            res.status(201).json({
                success: true,
                data: session,
                performance: perfMetrics.getMetrics()
            });

        } catch (error) {
            perfMetrics.end({ success: false, error: error.message });
            next(error);
        }
    };

    /**
     * Updates study session progress with comprehensive performance tracking
     */
    public updateProgress = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const perfMetrics = this.performanceMonitor.start('updateProgress');

        try {
            // Validate request body
            const { error, value } = updateStudySessionSchema.validate(req.body);
            if (error) {
                throw new Error(`Invalid update data: ${error.message}`);
            }

            // Extract session ID and verify ownership
            const sessionId = req.params.sessionId;
            const userId = (req.user as any)?.id;

            // Submit card review with voice data if present
            const result = await this.studyService.submitCardReview(
                sessionId,
                value.cardId,
                value.rating,
                value.voiceData
            );

            // Record performance metrics
            perfMetrics.end({
                userId,
                sessionId,
                success: true
            });

            res.status(200).json({
                success: true,
                data: result,
                performance: perfMetrics.getMetrics()
            });

        } catch (error) {
            perfMetrics.end({ success: false, error: error.message });
            next(error);
        }
    };

    /**
     * Processes voice response with enhanced confidence validation
     */
    public submitVoiceResponse = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const perfMetrics = this.performanceMonitor.start('submitVoiceResponse');

        try {
            // Validate user tier for voice access
            const userTier = (req.user as any)?.tier || 'free';
            if (!['pro', 'power'].includes(userTier)) {
                throw new Error('Voice mode requires Pro or Power subscription');
            }

            // Extract session data
            const sessionId = req.params.sessionId;
            const { cardId, voiceData } = req.body;

            // Process voice response
            const result = await this.studyService.submitCardReview(
                sessionId,
                cardId,
                0, // Rating will be calculated from voice confidence
                voiceData
            );

            perfMetrics.end({
                userId: (req.user as any)?.id,
                sessionId,
                success: true
            });

            res.status(200).json({
                success: true,
                data: result,
                performance: perfMetrics.getMetrics()
            });

        } catch (error) {
            perfMetrics.end({ success: false, error: error.message });
            next(error);
        }
    };

    /**
     * Completes study session with comprehensive analytics
     */
    public completeSession = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const perfMetrics = this.performanceMonitor.start('completeSession');

        try {
            const sessionId = req.params.sessionId;
            const userId = (req.user as any)?.id;

            // Complete session and generate analytics
            const result = await this.studyService.completeStudySession(sessionId);

            perfMetrics.end({
                userId,
                sessionId,
                success: true
            });

            res.status(200).json({
                success: true,
                data: result,
                performance: perfMetrics.getMetrics()
            });

        } catch (error) {
            perfMetrics.end({ success: false, error: error.message });
            next(error);
        }
    };

    /**
     * Retrieves session statistics with tier-specific metrics
     */
    public getSessionStatistics = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const perfMetrics = this.performanceMonitor.start('getSessionStatistics');

        try {
            const sessionId = req.params.sessionId;
            const userId = (req.user as any)?.id;

            // Get session state with enhanced metrics
            const session = await this.studyService.getSessionState(sessionId);

            perfMetrics.end({
                userId,
                sessionId,
                success: true
            });

            res.status(200).json({
                success: true,
                data: session,
                performance: perfMetrics.getMetrics()
            });

        } catch (error) {
            perfMetrics.end({ success: false, error: error.message });
            next(error);
        }
    };

    public async getSessionState(req: Request, res: Response): Promise<void> {
        const spanId = performanceMonitor.startSpan('get_session_state', {
            type: 'api_request',
            userId: req.user?.id
        });

        try {
            const session = await this.studyService.getSessionState(req.params.sessionId);
            
            performanceMonitor.endSpan(spanId, {
                success: true,
                cardCount: session.cards.length
            });

            res.json(session);
        } catch (error) {
            performanceMonitor.endSpan(spanId, {
                success: false,
                error: error.message
            });
            throw error;
        }
    }
}
