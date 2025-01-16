/**
 * @fileoverview Integration tests for content management functionality in membo.ai
 * Tests content capture, processing, and lifecycle management with performance validation
 * @version 1.0.0
 */

import { faker } from '@faker-js/faker'; // ^8.0.0
import { ContentService } from '../../src/services/ContentService';
import { IContent, ContentStatus } from '../../src/interfaces/IContent';
import { setupTestDatabase, createMockUser } from '../utils/testHelpers';

// Test constants
const TEST_TIMEOUT = 15000;
const PERFORMANCE_THRESHOLD = 10000; // 10 seconds max processing time
const MAX_PARALLEL_TESTS = 5;

describe('Content Management Integration Tests', () => {
  let contentService: ContentService;
  let testUser: { id: string };
  let testContent: IContent;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createMockUser();
    contentService = new ContentService();
  });

  beforeEach(() => {
    testContent = {
      userId: testUser.id,
      content: faker.lorem.paragraphs(3),
      metadata: {
        contentType: 'text',
        language: 'en',
        tags: ['test'],
        wordCount: 150,
        readingTime: 1,
        confidence: 0.95
      },
      source: 'web',
      sourceUrl: faker.internet.url(),
      status: ContentStatus.NEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null
    } as IContent;
  });

  describe('Content Capture', () => {
    it('should successfully capture and store new content', async () => {
      const captured = await contentService.captureContent(testContent, testUser.id);

      expect(captured).toBeDefined();
      expect(captured.id).toBeDefined();
      expect(captured.status).toBe(ContentStatus.NEW);
      expect(captured.userId).toBe(testUser.id);
    });

    it('should validate content format and structure', async () => {
      const invalidContent = { ...testContent, content: '' };
      
      await expect(
        contentService.captureContent(invalidContent, testUser.id)
      ).rejects.toThrow('Content validation failed');
    });

    it('should handle large content captures within performance limits', async () => {
      const largeContent = {
        ...testContent,
        content: faker.lorem.paragraphs(20)
      };

      const startTime = Date.now();
      const captured = await contentService.captureContent(largeContent, testUser.id);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(captured).toBeDefined();
    });

    it('should prevent duplicate content capture', async () => {
      await contentService.captureContent(testContent, testUser.id);
      
      await expect(
        contentService.captureContent(testContent, testUser.id)
      ).rejects.toThrow('Duplicate content detected');
    });
  });

  describe('Content Processing', () => {
    it('should process content and generate cards within time limit', async () => {
      const captured = await contentService.captureContent(testContent, testUser.id);
      
      const startTime = Date.now();
      const processed = await contentService.processContent(captured.id, testUser.id);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(processed.status).toBe(ContentStatus.PROCESSED);
      expect(processed.processedAt).toBeDefined();
    });

    it('should handle concurrent processing requests', async () => {
      const contents = await Promise.all(
        Array(MAX_PARALLEL_TESTS).fill(null).map(() => 
          contentService.captureContent({
            ...testContent,
            content: faker.lorem.paragraphs(2)
          }, testUser.id)
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(
        contents.map(content => 
          contentService.processContent(content.id, testUser.id)
        )
      );
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD * 2);
      results.forEach(result => {
        expect(result.status).toBe(ContentStatus.PROCESSED);
      });
    });

    it('should handle processing failures gracefully', async () => {
      const captured = await contentService.captureContent({
        ...testContent,
        content: '!@#$%^&*' // Invalid content
      }, testUser.id);

      const processed = await contentService.processContent(captured.id, testUser.id);
      expect(processed.status).toBe(ContentStatus.ERROR);
      expect(processed.metadata.error).toBeDefined();
    });
  });

  describe('Content Lifecycle', () => {
    let lifecycleContent: IContent;

    beforeEach(async () => {
      lifecycleContent = await contentService.captureContent(testContent, testUser.id);
    });

    it('should retrieve content by ID with security check', async () => {
      const retrieved = await contentService.getContentById(lifecycleContent.id, testUser.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(lifecycleContent.id);
      expect(retrieved.userId).toBe(testUser.id);
    });

    it('should prevent unauthorized content access', async () => {
      const unauthorizedUser = await createMockUser();
      
      await expect(
        contentService.getContentById(lifecycleContent.id, unauthorizedUser.id)
      ).rejects.toThrow('Unauthorized access');
    });

    it('should archive content successfully', async () => {
      const archived = await contentService.archiveContent(lifecycleContent.id, testUser.id);
      
      expect(archived.status).toBe(ContentStatus.ARCHIVED);
      expect(archived.updatedAt).toBeGreaterThan(archived.createdAt);
    });

    it('should delete content with proper authorization', async () => {
      const deleted = await contentService.deleteContent(lifecycleContent.id, testUser.id);
      expect(deleted).toBe(true);

      await expect(
        contentService.getContentById(lifecycleContent.id, testUser.id)
      ).rejects.toThrow('Content not found');
    });
  });

  describe('Content Validation', () => {
    it('should validate content structure and format', async () => {
      const result = await contentService.validateContent(testContent);
      expect(result.isValid).toBe(true);
    });

    it('should sanitize content properly', async () => {
      const unsafeContent = {
        ...testContent,
        content: '<script>alert("xss")</script>Test content'
      };

      const sanitized = await contentService.sanitizeContent(unsafeContent.content);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Test content');
    });
  });

  describe('User Content Management', () => {
    it('should retrieve all user content with pagination', async () => {
      // Create multiple content items
      await Promise.all(
        Array(5).fill(null).map(() => 
          contentService.captureContent({
            ...testContent,
            content: faker.lorem.paragraph()
          }, testUser.id)
        )
      );

      const userContent = await contentService.getUserContent(testUser.id);
      expect(Array.isArray(userContent)).toBe(true);
      expect(userContent.length).toBeGreaterThanOrEqual(5);
      userContent.forEach(content => {
        expect(content.userId).toBe(testUser.id);
      });
    });

    it('should filter content by status', async () => {
      const newContent = await contentService.getUserContent(
        testUser.id,
        ContentStatus.NEW
      );

      newContent.forEach(content => {
        expect(content.status).toBe(ContentStatus.NEW);
      });
    });
  });
});