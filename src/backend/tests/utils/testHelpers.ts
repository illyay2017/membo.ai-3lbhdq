/**
 * @fileoverview Comprehensive testing utilities for membo.ai backend services
 * Provides enhanced mock data generators, test fixtures, and standardized testing utilities
 * with support for voice interactions and FSRS algorithm testing
 * @version 1.0.0
 */

import { faker } from '@faker-js/faker';
import { IUser, IUserPreferences } from '../../src/interfaces/IUser';
import { ICard, ICardContent, ContentType, IFSRSData } from '../../src/interfaces/ICard';
import { IStudySession, IStudyPerformance } from '../../src/interfaces/IStudySession';
import { UserRole } from '../../src/constants/userRoles';
import { StudyModes, StudyModeConfig } from '../../src/constants/studyModes';

// Global test constants
export const TEST_USER_ID = 'test-user-123';
export const TEST_CARD_ID = 'test-card-456';
export const TEST_SESSION_ID = 'test-session-789';

/**
 * Generates a comprehensive mock user object with realistic test data
 * @param overrides - Optional property overrides for the mock user
 * @returns IUser - Complete mock user object
 */
export const createMockUser = (overrides: Partial<IUser> = {}): IUser => {
  const preferences: IUserPreferences = {
    studyMode: 'standard',
    voiceEnabled: faker.datatype.boolean(),
    dailyGoal: faker.number.int({ min: 10, max: 100 }),
    theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
    language: faker.location.countryCode('alpha-2'),
    notifications: {
      email: faker.datatype.boolean(),
      push: faker.datatype.boolean(),
      studyReminders: faker.datatype.boolean()
    }
  };

  const mockUser: IUser = {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    password: faker.string.alphanumeric(60), // Simulated bcrypt hash
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: faker.helpers.weightedArrayElement([
      { weight: 50, value: UserRole.FREE_USER },
      { weight: 30, value: UserRole.PRO_USER },
      { weight: 15, value: UserRole.POWER_USER },
      { weight: 4, value: UserRole.ENTERPRISE_ADMIN },
      { weight: 1, value: UserRole.SYSTEM_ADMIN }
    ]),
    preferences,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    lastLoginAt: faker.date.recent(),
    isActive: true,
    isEmailVerified: faker.datatype.boolean(),
    version: 1,
    ...overrides
  };

  return mockUser;
};

/**
 * Generates a sophisticated mock flashcard with FSRS data and voice compatibility
 * @param overrides - Optional property overrides for the mock card
 * @returns ICard - Complete mock card object
 */
export const createMockCard = (overrides: Partial<ICard> = {}): ICard => {
  const createContent = (): ICardContent => ({
    text: faker.lorem.paragraph(),
    type: faker.helpers.arrayElement(Object.values(ContentType)),
    metadata: {
      sourceUrl: faker.internet.url(),
      sourcePage: faker.number.int({ min: 1, max: 100 }),
      sourcePosition: {
        start: faker.number.int({ min: 0, max: 500 }),
        end: faker.number.int({ min: 501, max: 1000 })
      },
      languageCode: faker.location.countryCode('alpha-2'),
      codeLanguage: faker.helpers.arrayElement(['javascript', 'python', 'java']),
      aiGenerated: faker.datatype.boolean(),
      generationPrompt: faker.lorem.sentence(),
      lastModifiedBy: faker.string.uuid()
    }
  });

  const fsrsData: IFSRSData = {
    stability: faker.number.float({ min: 0, max: 100 }),
    difficulty: faker.number.float({ min: 0, max: 1 }),
    reviewCount: faker.number.int({ min: 0, max: 50 }),
    lastReview: faker.date.recent(),
    lastRating: faker.number.int({ min: 1, max: 4 })
  };

  const mockCard: ICard = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    contentId: faker.string.uuid(),
    frontContent: createContent(),
    backContent: createContent(),
    fsrsData,
    nextReview: faker.date.future(),
    compatibleModes: faker.helpers.arrayElements(Object.values(StudyModes), { min: 1, max: 3 }),
    tags: faker.helpers.multiple(() => faker.word.sample(), { count: { min: 1, max: 5 } }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides
  };

  return mockCard;
};

/**
 * Generates a detailed mock study session with performance metrics
 * @param overrides - Optional property overrides for the mock session
 * @returns IStudySession - Complete mock study session
 */
export const createMockStudySession = (overrides: Partial<IStudySession> = {}): IStudySession => {
  const mode = faker.helpers.arrayElement(Object.values(StudyModes));
  const modeConfig = StudyModeConfig[mode];

  const performance: IStudyPerformance = {
    totalCards: faker.number.int({ min: 10, max: 50 }),
    correctCount: faker.number.int({ min: 5, max: 45 }),
    averageConfidence: faker.number.float({ min: 0.6, max: 1 }),
    studyStreak: faker.number.int({ min: 1, max: 30 }),
    timeSpent: faker.number.int({ min: 300, max: 3600 }),
    fsrsProgress: {
      averageStability: faker.number.float({ min: 0, max: 100 }),
      averageDifficulty: faker.number.float({ min: 0, max: 1 }),
      retentionRate: faker.number.float({ min: 0.7, max: 1 }),
      intervalProgress: faker.number.float({ min: 0, max: 1 })
    }
  };

  const mockSession: IStudySession = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    mode,
    startTime: faker.date.recent(),
    endTime: faker.date.future(),
    cardsStudied: faker.helpers.multiple(() => faker.string.uuid(), { count: performance.totalCards }),
    performance,
    voiceEnabled: mode === StudyModes.VOICE,
    status: faker.helpers.arrayElement(['active', 'completed', 'paused']),
    settings: {
      sessionDuration: modeConfig.sessionDuration,
      cardsPerSession: faker.number.int({
        min: modeConfig.minCardsPerSession,
        max: modeConfig.maxCardsPerSession
      }),
      showConfidenceButtons: modeConfig.showConfidenceButtons,
      enableFSRS: modeConfig.enableFSRS,
      voiceConfig: {
        recognitionThreshold: 0.85,
        language: faker.location.countryCode('alpha-2'),
        useNativeSpeaker: faker.datatype.boolean()
      },
      fsrsConfig: {
        requestRetention: 0.9,
        maximumInterval: 365,
        easyBonus: 1.3,
        hardPenalty: 0.8
      }
    },
    ...overrides
  };

  return mockSession;
};

/**
 * Initializes test database with comprehensive mock data
 * @returns Promise<void> - Resolves when database is initialized
 */
export const setupTestDatabase = async (): Promise<void> => {
  // Clear existing test data
  await jest.isolateModules(async () => {
    // Create mock users across different roles
    const users = Array.from({ length: 5 }, () => createMockUser());
    
    // Generate varied card types
    const cards = Array.from({ length: 20 }, () => createMockCard());
    
    // Create study sessions with different modes
    const sessions = Array.from({ length: 10 }, () => createMockStudySession());
    
    // Initialize test database with mock data
    // Note: Actual database operations would be implemented here
    // This is a placeholder for the implementation
  });
};