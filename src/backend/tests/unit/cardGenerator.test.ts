import { jest } from '@jest/globals';
import { OpenAIApi } from 'openai'; // version: ^4.0.0
import { CardGenerator } from '../../src/core/ai/cardGenerator';
import { ICard } from '../../src/interfaces/ICard';
import { IContent, ContentStatus } from '../../src/interfaces/IContent';
import { StudyModes } from '../../src/constants/studyModes';
import { createMockCard } from '../utils/testHelpers';
import Redis from 'ioredis'; // version: ^5.0.0

// Test constants
const TEST_TIMEOUT = 15000;
const PERFORMANCE_THRESHOLD = 10000; // 10 seconds max processing time
const MOCK_CONTENT_ID = 'test-content-123';
const MOCK_USER_ID = 'test-user-456';

describe('CardGenerator', () => {
  let cardGenerator: CardGenerator;
  let mockOpenAIClient: jest.Mocked<OpenAIApi>;
  let mockRedisClient: jest.Mocked<Redis>;

  // Mock test content
  const testContent: IContent = {
    id: MOCK_CONTENT_ID,
    userId: MOCK_USER_ID,
    content: 'Test content for card generation',
    metadata: {
      contentType: 'text',
      language: 'en',
      tags: ['test'],
      wordCount: 100
    },
    source: 'web',
    sourceUrl: 'https://example.com',
    status: ContentStatus.NEW,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null
  };

  // Mock OpenAI response
  const mockAIResponse = {
    data: {
      choices: [{
        message: {
          content: JSON.stringify([{
            front: 'What is the test content?',
            back: 'This is test content for card generation'
          }])
        }
      }],
      usage: {
        total_tokens: 100
      }
    }
  };

  beforeEach(() => {
    // Setup mocks
    mockOpenAIClient = {
      createChatCompletion: jest.fn().mockResolvedValue(mockAIResponse),
      createModeration: jest.fn().mockResolvedValue({
        data: { results: [{ flagged: false }] }
      })
    } as unknown as jest.Mocked<OpenAIApi>;

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK')
    } as unknown as jest.Mocked<Redis>;

    cardGenerator = new CardGenerator(mockOpenAIClient, mockRedisClient);

    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should generate cards from valid content', async () => {
    const cards = await cardGenerator.generateFromContent(testContent);

    // Verify card generation
    expect(cards).toBeDefined();
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);

    // Verify card structure
    const card = cards[0];
    expect(card).toHaveProperty('id');
    expect(card).toHaveProperty('userId', MOCK_USER_ID);
    expect(card).toHaveProperty('contentId', MOCK_CONTENT_ID);
    expect(card.frontContent).toBeDefined();
    expect(card.backContent).toBeDefined();
    expect(card.compatibleModes).toContain(StudyModes.STANDARD);

    // Verify OpenAI API call
    expect(mockOpenAIClient.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(mockOpenAIClient.createModeration).toHaveBeenCalledTimes(1);
  }, TEST_TIMEOUT);

  test('should handle invalid content', async () => {
    const invalidContent = { ...testContent, content: '' };

    await expect(cardGenerator.generateFromContent(invalidContent))
      .rejects.toThrow('Content length out of acceptable range');

    expect(mockOpenAIClient.createChatCompletion).not.toHaveBeenCalled();
  });

  test('should determine compatible study modes', async () => {
    // Test voice-compatible content
    const voiceContent: IContent = {
      ...testContent,
      content: 'Short, voice-friendly content'
    };

    const voiceCards = await cardGenerator.generateFromContent(voiceContent);
    expect(voiceCards[0].compatibleModes).toContain(StudyModes.VOICE);

    // Test quiz-compatible content
    const quizContent: IContent = {
      ...testContent,
      content: 'Detailed content suitable for quiz generation with comprehensive explanation'
    };

    const quizCards = await cardGenerator.generateFromContent(quizContent);
    expect(quizCards[0].compatibleModes).toContain(StudyModes.QUIZ);
  });

  test('should respect processing time limits', async () => {
    const startTime = Date.now();
    await cardGenerator.generateFromContent(testContent);
    const processingTime = Date.now() - startTime;

    expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
  });

  test('should use cache when available', async () => {
    const mockCachedCard = createMockCard({
      userId: MOCK_USER_ID,
      contentId: MOCK_CONTENT_ID
    });

    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify([mockCachedCard]));

    const cards = await cardGenerator.generateFromContent(testContent);

    expect(cards).toEqual([mockCachedCard]);
    expect(mockOpenAIClient.createChatCompletion).not.toHaveBeenCalled();
    expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
  });

  test('should handle AI service errors', async () => {
    mockOpenAIClient.createChatCompletion.mockRejectedValueOnce(
      new Error('API Error')
    );

    await expect(cardGenerator.generateFromContent(testContent))
      .rejects.toThrow('Failed to process content after max retries');

    expect(mockOpenAIClient.createChatCompletion).toHaveBeenCalledTimes(3); // Max retries
  });

  test('should validate generated cards', async () => {
    mockOpenAIClient.createChatCompletion.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify([{ front: '', back: '' }]) // Invalid card
          }
        }],
        usage: { total_tokens: 100 }
      }
    });

    await expect(cardGenerator.generateFromContent(testContent))
      .rejects.toThrow('Generated cards failed validation');
  });

  test('should handle content moderation', async () => {
    mockOpenAIClient.createModeration.mockResolvedValueOnce({
      data: { results: [{ flagged: true }] }
    });

    await expect(cardGenerator.generateFromContent(testContent))
      .rejects.toThrow('Content flagged by moderation check');

    expect(mockOpenAIClient.createChatCompletion).not.toHaveBeenCalled();
  });

  test('should track generation metrics', async () => {
    await cardGenerator.generateFromContent(testContent);
    const metrics = cardGenerator.getMetrics();

    expect(metrics).toHaveProperty('processingTime');
    expect(metrics).toHaveProperty('tokenCount', 100);
    expect(metrics).toHaveProperty('cardCount');
    expect(metrics).toHaveProperty('cacheHit', false);
  });
});