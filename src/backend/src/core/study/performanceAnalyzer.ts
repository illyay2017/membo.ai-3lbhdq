/**
 * @fileoverview Core service for analyzing user study performance metrics, learning patterns,
 * and FSRS algorithm effectiveness. Provides insights for optimizing the spaced repetition system
 * and maintaining high retention rates.
 * @version 1.0.0
 */

import { IStudySession, IStudyPerformance } from '../../interfaces/IStudySession';
import { FSRSAlgorithm } from './FSRSAlgorithm';
import { CardScheduler } from './cardScheduler';
import dayjs from 'dayjs'; // ^1.11.0

/**
 * Interface for enhanced performance metrics including voice mode and streak analysis
 */
interface IEnhancedPerformance extends IStudyPerformance {
    voiceModeEffectiveness?: number;
    streakStability?: number;
    retentionTrend?: number[];
    optimalStudyTime?: {
        timeOfDay: number;
        dayOfWeek: number;
        sessionDuration: number;
    };
}

/**
 * Interface for streak analysis metrics
 */
interface IStreakAnalysis {
    currentStreak: number;
    longestStreak: number;
    streakStability: number;
    nextReviewRecommendation: Date;
    riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Core service for analyzing and optimizing study performance
 */
export class PerformanceAnalyzer {
    private readonly fsrsAlgorithm: FSRSAlgorithm;
    private readonly cardScheduler: CardScheduler;
    private readonly performanceCache: Map<string, IEnhancedPerformance>;
    private readonly targetRetentionRate: number = 0.85;
    private readonly minStreakDays: number = 14;

    constructor(fsrsAlgorithm: FSRSAlgorithm, cardScheduler: CardScheduler) {
        this.fsrsAlgorithm = fsrsAlgorithm;
        this.cardScheduler = cardScheduler;
        this.performanceCache = new Map();
    }

    /**
     * Analyzes study session performance with enhanced metrics for voice mode and retention
     * @param session Study session to analyze
     * @returns Enhanced performance analysis
     */
    public async analyzeSessionPerformance(
        session: IStudySession
    ): Promise<IEnhancedPerformance> {
        const basePerformance = session.performance;
        const cardsStudied = session.cardsStudied.length;

        // Calculate base retention rate
        const retentionRate = basePerformance.correctCount / cardsStudied;

        // Analyze voice mode effectiveness if enabled
        const voiceModeEffectiveness = session.voiceEnabled
            ? this.analyzeVoiceModeEffectiveness(session)
            : undefined;

        // Calculate FSRS effectiveness
        const fsrsEffectiveness = basePerformance.fsrsProgress.retentionRate;

        // Generate enhanced performance metrics
        const enhancedPerformance: IEnhancedPerformance = {
            ...basePerformance,
            voiceModeEffectiveness,
            streakStability: this.calculateStreakStability(basePerformance.studyStreak),
            retentionTrend: this.calculateRetentionTrend(session),
            optimalStudyTime: this.determineOptimalStudyTime(session),
            totalCards: cardsStudied,
            correctCount: basePerformance.correctCount,
            averageConfidence: this.calculateAdjustedConfidence(
                basePerformance.averageConfidence,
                session.voiceEnabled
            ),
            studyStreak: basePerformance.studyStreak,
            timeSpent: basePerformance.timeSpent,
            fsrsProgress: {
                ...basePerformance.fsrsProgress,
                retentionRate: Math.max(retentionRate, fsrsEffectiveness)
            }
        };

        // Cache the enhanced performance data
        this.performanceCache.set(session.id, enhancedPerformance);

        return enhancedPerformance;
    }

    /**
     * Analyzes user's study streak patterns and provides maintenance recommendations
     * @param userId User identifier
     * @returns Comprehensive streak analysis
     */
    public async analyzeStudyStreak(userId: string): Promise<IStreakAnalysis> {
        const streakData = await this.getStreakHistory(userId);
        const currentStreak = streakData.currentStreak;
        const streakStability = this.calculateStreakStability(currentStreak);

        // Calculate risk level based on streak stability
        const riskLevel = this.calculateStreakRiskLevel(streakStability);

        // Generate next review recommendation
        const nextReviewRecommendation = this.calculateNextReviewTime(
            streakStability,
            currentStreak
        );

        return {
            currentStreak,
            longestStreak: streakData.longestStreak,
            streakStability,
            nextReviewRecommendation,
            riskLevel
        };
    }

    /**
     * Generates comprehensive performance report with ML-driven insights
     * @param userId User identifier
     * @param startDate Report start date
     * @param endDate Report end date
     * @returns Detailed performance analysis and recommendations
     */
    public async generatePerformanceReport(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<object> {
        const sessions = await this.getSessionsInRange(userId, startDate, endDate);
        const retentionTrend = this.aggregateRetentionTrend(sessions);
        const voiceModeImpact = this.analyzeVoiceModeImpact(sessions);
        const streakAnalysis = await this.analyzeStudyStreak(userId);

        return {
            overview: {
                averageRetention: this.calculateAverageRetention(retentionTrend),
                streakMaintenance: streakAnalysis,
                learningEfficiency: this.calculateLearningEfficiency(sessions)
            },
            voiceMode: {
                effectiveness: voiceModeImpact.effectiveness,
                confidenceCorrelation: voiceModeImpact.confidenceCorrelation,
                recommendedUsage: voiceModeImpact.recommendations
            },
            recommendations: this.generatePersonalizedRecommendations(
                retentionTrend,
                streakAnalysis,
                voiceModeImpact
            ),
            trends: {
                retention: retentionTrend,
                confidence: this.calculateConfidenceTrend(sessions),
                timeEfficiency: this.analyzeTimeEfficiency(sessions)
            }
        };
    }

    /**
     * Calculates voice mode effectiveness and confidence correlation
     */
    private analyzeVoiceModeEffectiveness(session: IStudySession): number {
        const baseConfidence = session.performance.averageConfidence;
        const correctRate = session.performance.correctCount / session.cardsStudied.length;
        
        return (baseConfidence + correctRate) / 2;
    }

    /**
     * Calculates streak stability score based on historical patterns
     */
    private calculateStreakStability(currentStreak: number): number {
        const stabilityBase = Math.min(currentStreak / this.minStreakDays, 1);
        const stabilityModifier = currentStreak > this.minStreakDays ? 1.2 : 1;
        
        return Math.min(stabilityBase * stabilityModifier, 1);
    }

    /**
     * Determines optimal study time based on performance patterns
     */
    private determineOptimalStudyTime(session: IStudySession): {
        timeOfDay: number;
        dayOfWeek: number;
        sessionDuration: number;
    } {
        const startTime = dayjs(session.startTime);
        return {
            timeOfDay: startTime.hour(),
            dayOfWeek: startTime.day(),
            sessionDuration: session.performance.timeSpent
        };
    }

    /**
     * Calculates adjusted confidence score with voice mode consideration
     */
    private calculateAdjustedConfidence(
        baseConfidence: number,
        voiceEnabled: boolean
    ): number {
        return voiceEnabled
            ? baseConfidence * 0.9 // Apply slight penalty for voice mode
            : baseConfidence;
    }

    /**
     * Calculates retention trend from session data
     */
    private calculateRetentionTrend(session: IStudySession): number[] {
        const fsrsProgress = session.performance.fsrsProgress;
        return [
            fsrsProgress.retentionRate,
            fsrsProgress.averageStability,
            this.calculateAdjustedConfidence(
                session.performance.averageConfidence,
                session.voiceEnabled
            )
        ];
    }

    /**
     * Determines streak risk level based on stability score
     */
    private calculateStreakRiskLevel(
        stability: number
    ): 'low' | 'medium' | 'high' {
        if (stability >= 0.8) return 'low';
        if (stability >= 0.6) return 'medium';
        return 'high';
    }

    /**
     * Calculates next recommended review time based on streak analysis
     */
    private calculateNextReviewTime(
        stability: number,
        currentStreak: number
    ): Date {
        const baseInterval = 24; // hours
        const stabilityModifier = Math.max(0.5, stability);
        const streakBonus = Math.min(currentStreak / this.minStreakDays, 1.5);
        
        const reviewInterval = baseInterval * stabilityModifier * streakBonus;
        
        return dayjs().add(reviewInterval, 'hour').toDate();
    }

    /**
     * Retrieves and processes user's streak history
     */
    private async getStreakHistory(userId: string): Promise<{
        currentStreak: number;
        longestStreak: number;
    }> {
        // Mock implementation - replace with actual database query
        return {
            currentStreak: 15,
            longestStreak: 30
        };
    }

    /**
     * Retrieves study sessions within date range
     */
    private async getSessionsInRange(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<IStudySession[]> {
        // Mock implementation - replace with actual database query
        return [];
    }
}