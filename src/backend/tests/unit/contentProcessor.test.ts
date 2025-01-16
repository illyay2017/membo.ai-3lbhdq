import { ContentProcessor } from '../../src/core/ai/contentProcessor';
import { IContent, ContentStatus } from '../../src/interfaces/IContent';
import { OpenAIApi } from 'openai'; // version: ^4.0.0
import now from 'performance-now'; // version: ^2.1.0

// Constants for testing
const MOCK_CONTENT_TEXT = "Sample educational content for testing content processing with various formats and lengths";
const MOCK_OPENAI_KEY = "sk-test-key-12345";
const PROCESSING_TIMEOUT = 10000;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 5000;

/**
 * Mock OpenAI API implementation for testing
 */
class MockOpenAIApi {
  async createChatCompletion(options: any) {
    return {
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              topics: ['Sample Topic'],
              complexity: 'intermediate',
              recommendedCardTypes: ['basic'],
              languageAssessment: {
                language: 'en',
                confidence: 0.95
              },
              prerequisites: []
            })
          }
        }],
        usage: {
          total_tokens: 150
        }
      }
    };
  }

  async createModeration(options: any) {
    return {
      data: {
        results: [{
          flagged: false
        }]
      }
    };
  }
}

/**
 * Helper function to create mock content
 */
const createMockContent = (overrides: Partial<IContent> = {}): IContent => ({
  id: 'test-content-id',
  userId: 'test-user-id',
  content: MOCK_CONTENT_TEXT,
  metadata: {},
  source: 'web',
  sourceUrl: 'https://example.com',
  status: ContentStatus.NEW,
  createdAt: new Date(),
  updatedAt: new Date(),
  processedAt: null,
  ...overrides
});

/**
 * Helper function to measure processing time
 */
const measureProcessingTime = async (processor: ContentProcessor, content: IContent): Promise<number> => {
  const start = now();
  await processor.processContent(content);
  return now() - start;
};

describe('ContentProcessor', () => {
  let processor: ContentProcessor;
  let mockOpenAI: MockOpenAIApi;

  beforeEach(() => {
    mockOpenAI = new MockOpenAIApi();
    processor = new ContentProcessor(mockOpenAI as unknown as OpenAIApi);
  });

  describe('Content Validation', () => {
    it('should reject empty content', async () => {
      const emptyContent = createMockContent({ content: '' });
      await expect(processor.processContent(emptyContent)).rejects.toThrow('Content length out of acceptable range');
    });

    it('should reject content below minimum length', async () => {
      const shortContent = createMockContent({ content: 'Too short' });
      await expect(processor.processContent(shortContent)).rejects.toThrow('Content length out of acceptable range');
    });

    it('should reject content above maximum length', async () => {
      const longContent = createMockContent({ content: 'a'.repeat(MAX_CONTENT_LENGTH + 1) });
      await expect(processor.processContent(longContent)).rejects.toThrow('Content length out of acceptable range');
    });

    it('should validate content metadata structure', async () => {
      const invalidContent = createMockContent();
      delete (invalidContent as any).metadata;
      await expect(processor.processContent(invalidContent)).rejects.toThrow('Content validation failed');
    });
  });

  describe('Content Processing', () => {
    it('should successfully process valid content', async () => {
      const content = createMockContent();
      const processed = await processor.processContent(content);

      expect(processed.status).toBe(ContentStatus.PROCESSED);
      expect(processed.processedAt).toBeInstanceOf(Date);
      expect(processed.metadata).toHaveProperty('topics');
      expect(processed.metadata).toHaveProperty('complexity');
      expect(processed.metadata).toHaveProperty('processingMetrics');
    });

    it('should update content status during processing', async () => {
      const content = createMockContent();
      const processingPromise = processor.processContent(content);
      
      // Status should be PROCESSING immediately after start
      expect(content.status).toBe(ContentStatus.PROCESSING);
      
      const processed = await processingPromise;
      expect(processed.status).toBe(ContentStatus.PROCESSED);
    });

    it('should handle processing errors gracefully', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(mockOpenAI, 'createChatCompletion').mockRejectedValueOnce(mockError);

      const content = createMockContent();
      await expect(processor.processContent(content)).rejects.toThrow('API Error');
      expect(content.status).toBe(ContentStatus.ERROR);
      expect(content.metadata.error).toBeDefined();
    });

    it('should sanitize content before processing', async () => {
      const unsafeContent = createMockContent({
        content: '<script>alert("xss")</script>Sample content'
      });
      const processed = await processor.processContent(unsafeContent);
      expect(processed.content).not.toContain('<script>');
    });
  });

  describe('Performance Requirements', () => {
    it('should complete processing within 10 second SLA', async () => {
      const content = createMockContent({
        content: 'a'.repeat(1000) // Substantial content size
      });

      const processingTime = await measureProcessingTime(processor, content);
      expect(processingTime).toBeLessThan(PROCESSING_TIMEOUT);
    });

    it('should handle concurrent processing efficiently', async () => {
      const contents = Array.from({ length: 5 }, () => createMockContent());
      const startTime = now();
      
      await Promise.all(contents.map(content => processor.processContent(content)));
      
      const totalTime = now() - startTime;
      expect(totalTime).toBeLessThan(PROCESSING_TIMEOUT * 2); // Allow some overhead for concurrent processing
    });

    it('should track and report processing metrics', async () => {
      const content = createMockContent();
      const processed = await processor.processContent(content);

      expect(processed.metadata.processingMetrics).toMatchObject({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        processingDuration: expect.any(Number),
        tokenCount: expect.any(Number),
        retryCount: expect.any(Number)
      });
    });
  });

  describe('AI Integration', () => {
    it('should retry failed AI requests', async () => {
      const failingMockOpenAI = new MockOpenAIApi();
      let attempts = 0;
      jest.spyOn(failingMockOpenAI, 'createChatCompletion').mockImplementation(async () => {
        attempts++;
        if (attempts < 2) throw new Error('Temporary failure');
        return mockOpenAI.createChatCompletion({});
      });

      const processor = new ContentProcessor(failingMockOpenAI as unknown as OpenAIApi);
      const content = createMockContent();
      const processed = await processor.processContent(content);

      expect(attempts).toBe(2);
      expect(processed.status).toBe(ContentStatus.PROCESSED);
    });

    it('should validate AI response structure', async () => {
      jest.spyOn(mockOpenAI, 'createChatCompletion').mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Invalid JSON response'
            }
          }],
          usage: { total_tokens: 150 }
        }
      });

      const content = createMockContent();
      const processed = await processor.processContent(content);

      expect(processed.metadata.isProcessable).toBe(false);
      expect(processed.metadata.error).toBeDefined();
    });
  });
});