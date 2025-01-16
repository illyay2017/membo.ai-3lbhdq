/**
 * Test utility functions and mock data generators for web client testing
 * Implements comprehensive support for component, hook, and service testing
 * @version 1.0.0
 */

import { faker } from '@faker-js/faker';
import { LoginCredentials } from '../../src/types/auth';
import { Card, ContentType, FSRSData } from '../../src/types/card';
import { Content, ContentStatus, ContentSource } from '../../src/types/content';
import { STUDY_MODES, FSRS_CONFIG } from '../../src/constants/study';

/**
 * Generates mock login credentials for authentication testing
 * @returns {LoginCredentials} Mock credentials with email and password
 */
export const generateMockLoginCredentials = (): LoginCredentials => ({
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12, pattern: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/ })
});

/**
 * Generates a mock flashcard with comprehensive study data
 * @param {Partial<Card>} overrides - Optional property overrides
 * @returns {Card} Complete mock card with FSRS data
 */
export const generateMockCard = (overrides: Partial<Card> = {}): Card => {
  const now = new Date();
  const fsrsData: FSRSData = {
    stability: faker.number.float({ min: FSRS_CONFIG.retentionOptimization.minimumStability, max: FSRS_CONFIG.retentionOptimization.maximumStability }),
    difficulty: faker.number.float({ min: 0.5, max: 1.5 }),
    reviewCount: faker.number.int({ min: 0, max: 10 }),
    lastReview: faker.date.past(),
    lastRating: faker.number.int({ min: 1, max: 4 }),
    performanceHistory: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
      timestamp: faker.date.past(),
      rating: faker.number.int({ min: 1, max: 4 }),
      studyMode: faker.helpers.arrayElement(Object.values(STUDY_MODES)),
      responseTime: faker.number.int({ min: 1000, max: 10000 })
    }))
  };

  const mockCard: Card = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    contentId: faker.string.uuid(),
    frontContent: {
      text: faker.lorem.paragraph(),
      type: ContentType.HTML,
      metadata: {
        aiModel: 'gpt-4',
        generationPrompt: faker.lorem.sentence(),
        confidence: faker.number.float({ min: 0.7, max: 1.0 }),
        processingTime: faker.number.int({ min: 100, max: 1000 })
      },
      sourceUrl: faker.internet.url(),
      aiGenerated: true
    },
    backContent: {
      text: faker.lorem.paragraphs(2),
      type: ContentType.HTML,
      metadata: {
        aiModel: 'gpt-4',
        generationPrompt: faker.lorem.sentence(),
        confidence: faker.number.float({ min: 0.7, max: 1.0 }),
        processingTime: faker.number.int({ min: 100, max: 1000 })
      },
      sourceUrl: faker.internet.url(),
      aiGenerated: true
    },
    fsrsData,
    nextReview: faker.date.future(),
    compatibleModes: [STUDY_MODES.STANDARD, STUDY_MODES.VOICE],
    tags: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.lorem.word()),
    createdAt: now,
    updatedAt: now,
    ...overrides
  };

  return mockCard;
};

/**
 * Generates mock content with processing metadata
 * @param {Partial<Content>} overrides - Optional property overrides
 * @returns {Content} Complete mock content item
 */
export const generateMockContent = (overrides: Partial<Content> = {}): Content => {
  const now = new Date();
  const source = faker.helpers.arrayElement(Object.values(ContentSource));

  const mockContent: Content = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    content: faker.lorem.paragraphs(3),
    metadata: {
      title: faker.lorem.sentence(),
      author: faker.person.fullName(),
      tags: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.lorem.word()),
      source,
      sourceUrl: source === ContentSource.WEB ? faker.internet.url() : null,
      pageNumber: source === ContentSource.PDF ? faker.number.int({ min: 1, max: 100 }) : null,
      chapterTitle: faker.lorem.words(3),
      captureContext: {
        section: faker.lorem.words(2),
        highlight: faker.lorem.sentence(),
        notes: faker.lorem.paragraph()
      }
    },
    status: faker.helpers.arrayElement(Object.values(ContentStatus)),
    createdAt: now,
    updatedAt: now,
    processedAt: faker.date.past(),
    processingError: null,
    ...overrides
  };

  return mockContent;
};

/**
 * Waits for an element to appear in the DOM with timeout
 * @param {string} selector - DOM selector to wait for
 * @param {number} timeout - Maximum wait time in ms (default: 5000)
 * @returns {Promise<Element>} Found DOM element
 */
export const waitForElement = (selector: string, timeout = 5000): Promise<Element> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        return;
      }

      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
};

/**
 * Measures and validates API response times
 * @param {Promise<T>} apiCall - API call to measure
 * @param {number} threshold - Maximum acceptable duration in ms (default: 200)
 * @returns {Promise<{response: T, duration: number}>} Response and timing data
 */
export const measureApiResponse = async <T>(
  apiCall: Promise<T>,
  threshold = 200
): Promise<{ response: T; duration: number }> => {
  const start = performance.now();
  const response = await apiCall;
  const duration = performance.now() - start;

  if (duration > threshold) {
    console.warn(`API call exceeded ${threshold}ms threshold (took ${duration}ms)`);
  }

  return { response, duration };
};