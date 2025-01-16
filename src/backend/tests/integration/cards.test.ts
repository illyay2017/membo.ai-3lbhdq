import { jest } from '@jest/globals';
import supertest from 'supertest';
import { faker } from '@faker-js/faker';
import { CardService } from '../../src/services/CardService';
import { StudyModes } from '../../src/constants/studyModes';
import { ICard } from '../../src/interfaces/ICard';
import { ContentType } from '../../src/interfaces/ICard';
import { FSRSAlgorithm } from '../../src/core/study/FSRSAlgorithm';
import { validateSchema } from '../../src/utils/validation';

// Constants for testing
const TEST_USER_ID = 'test-user-123';
const PERFORMANCE_THRESHOLD_MS = 5000;
const VOICE_ACCURACY_THRESHOLD = 0.85;
const TEST_CONTENT = 'Test content for card generation';

// Initialize services
let cardService: CardService;
let fsrsAlgorithm: FSRSAlgorithm;

// Mock data generators
const generateTestCard = (): Partial<ICard> => ({
  userId: TEST_USER_ID,
  frontContent: {
    text: faker.lorem.sentence(),
    type: ContentType.TEXT,
    metadata: {
      aiGenerated: false,
      lastModifiedBy: 'test'
    }
  },
  backContent: {
    text: faker.lorem.paragraph(),
    type: ContentType.TEXT,
    metadata: {
      aiGenerated: false,
      lastModifiedBy: 'test'
    }
  },
  tags: [faker.lorem.word(), faker.lorem.word()]
});

describe('Card Creation and Validation', () => {
  beforeAll(async () => {
    cardService = new CardService();
    fsrsAlgorithm = new FSRSAlgorithm();
    
    // Reset test database and initialize test user
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test('should create a new card with valid data within performance threshold', async () => {
    const startTime = Date.now();
    const cardData = generateTestCard();
    
    const card = await cardService.createCard(cardData);
    
    expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    expect(card).toHaveProperty('id');
    expect(card.userId).toBe(TEST_USER_ID);
    expect(card.fsrsData).toBeDefined();
    expect(card.compatibleModes).toContain(StudyModes.STANDARD);
  });

  test('should generate cards from content using AI with accuracy verification', async () => {
    const content = TEST_CONTENT;
    
    const cards = await cardService.generateCardsFromContent(
      content,
      TEST_USER_ID,
      StudyModes.STANDARD
    );
    
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(card => {
      expect(validateSchema(card, cardSchema).isValid).toBe(true);
      expect(card.frontContent.metadata.aiGenerated).toBe(true);
    });
  });

  test('should fail card creation with invalid data and proper error messages', async () => {
    const invalidCard = {
      userId: TEST_USER_ID,
      frontContent: { text: '' }, // Invalid: empty content
      backContent: { text: faker.lorem.paragraph() }
    };
    
    await expect(cardService.createCard(invalidCard))
      .rejects
      .toThrow('Failed to create card');
  });
});

describe('Study Mode Integration', () => {
  test('should switch between study modes seamlessly', async () => {
    const card = await cardService.createCard(generateTestCard());
    
    // Test mode switching
    await cardService.updateCardMode(card.id, StudyModes.VOICE);
    const updatedCard = await cardService.getCardById(card.id);
    
    expect(updatedCard.compatibleModes).toContain(StudyModes.VOICE);
  });

  test('should process voice responses with accuracy threshold', async () => {
    const card = await cardService.createCard(generateTestCard());
    const voiceResponse = 'Test voice response';
    
    const result = await cardService.processVoiceResponse(
      card.id,
      voiceResponse,
      StudyModes.VOICE
    );
    
    expect(result.confidence).toBeGreaterThanOrEqual(VOICE_ACCURACY_THRESHOLD);
  });

  test('should maintain study streak across mode changes', async () => {
    const card = await cardService.createCard(generateTestCard());
    
    // Record reviews in different modes
    await cardService.recordReview(card.id, 4, StudyModes.STANDARD);
    await cardService.recordReview(card.id, 4, StudyModes.VOICE);
    
    const updatedCard = await cardService.getCardById(card.id);
    expect(updatedCard.fsrsData.streakCount).toBe(2);
  });
});

describe('FSRS Algorithm Verification', () => {
  test('should calculate retention scores accurately', async () => {
    const card = await cardService.createCard(generateTestCard());
    
    // Simulate multiple reviews
    await cardService.recordReview(card.id, 4, StudyModes.STANDARD);
    const updatedCard = await cardService.getCardById(card.id);
    
    expect(updatedCard.fsrsData.retentionScore).toBeGreaterThan(0);
    expect(updatedCard.fsrsData.stability).toBeGreaterThan(0.5);
  });

  test('should adjust review intervals based on performance', async () => {
    const card = await cardService.createCard(generateTestCard());
    const initialNextReview = card.nextReview;
    
    // Record good performance
    await cardService.recordReview(card.id, 4, StudyModes.STANDARD);
    const updatedCard = await cardService.getCardById(card.id);
    
    expect(updatedCard.nextReview).toBeGreaterThan(initialNextReview);
  });

  test('should optimize scheduling for retention', async () => {
    const cards = await cardService.getUserCards(TEST_USER_ID);
    const dueCards = await cardService.getDueCards(
      TEST_USER_ID,
      StudyModes.STANDARD,
      0.85
    );
    
    expect(dueCards.length).toBeLessThanOrEqual(cards.length);
    dueCards.forEach(card => {
      expect(card.nextReview).toBeLessThanOrEqual(new Date());
    });
  });
});

describe('Performance and Security', () => {
  test('should handle high-volume card operations within threshold', async () => {
    const startTime = Date.now();
    const operations = Array(100).fill(null).map(() => 
      cardService.createCard(generateTestCard())
    );
    
    await Promise.all(operations);
    
    expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });

  test('should prevent unauthorized access attempts', async () => {
    const card = await cardService.createCard(generateTestCard());
    
    // Attempt to access with wrong user ID
    await expect(cardService.getCardById(card.id, 'wrong-user'))
      .rejects
      .toThrow('Unauthorized');
  });

  test('should maintain data integrity during concurrent operations', async () => {
    const card = await cardService.createCard(generateTestCard());
    
    // Simulate concurrent reviews
    const operations = Array(10).fill(null).map(() =>
      cardService.recordReview(card.id, 4, StudyModes.STANDARD)
    );
    
    await Promise.all(operations);
    const updatedCard = await cardService.getCardById(card.id);
    
    expect(updatedCard.fsrsData.reviewCount).toBe(10);
  });
});

// Helper functions
async function setupTestEnvironment() {
  // Initialize test database
  // Create test user
  // Configure test environment
}

async function cleanupTestEnvironment() {
  // Clean up test data
  // Close connections
}

// Schema for card validation
const cardSchema = {
  id: 'required|string',
  userId: 'required|string',
  frontContent: 'required|object',
  backContent: 'required|object',
  fsrsData: 'required|object',
  compatibleModes: 'required|array',
  tags: 'array'
};