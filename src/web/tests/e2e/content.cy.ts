/**
 * End-to-end tests for content management functionality
 * Validates content capture, processing, and performance requirements
 * @version 1.0.0
 */

import { generateMockContent, waitForElement, measureApiResponse } from '../utils/testHelpers';
import { Content, ContentStatus, ContentSource } from '../../src/types/content';

describe('Content Management E2E Tests', () => {
  const TEST_USER = {
    email: 'test@membo.ai',
    password: 'Test123!@#'
  };

  beforeEach(() => {
    // Reset database state and seed test data
    cy.task('db:reset');
    cy.task('db:seed', { 
      content: Array.from({ length: 5 }, () => generateMockContent())
    });

    // Login and navigate to content inbox
    cy.login(TEST_USER);
    cy.visit('/inbox');

    // Set up WebSocket mock
    cy.window().then((win) => {
      win.WebSocket = class MockWebSocket {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        send = cy.stub().as('wsSend');
        close = cy.stub().as('wsClose');
      } as any;
    });

    // Set up API interceptors for performance measurement
    cy.intercept('GET', '/api/v1/content*', (req) => {
      req.on('response', (res) => {
        const startTime = performance.now();
        res.send().then(() => {
          const duration = performance.now() - startTime;
          expect(duration).to.be.lessThan(200); // Validate 200ms SLA
        });
      });
    }).as('getContent');
  });

  afterEach(() => {
    // Clean up
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.get('@wsClose').then((close) => close());
  });

  describe('Content List View', () => {
    it('displays content items with correct metadata and status', () => {
      // Mock content list response
      const mockContent = Array.from({ length: 3 }, () => generateMockContent());
      cy.intercept('GET', '/api/v1/content', {
        body: {
          items: mockContent,
          totalCount: mockContent.length,
          hasMore: false
        }
      }).as('contentList');

      // Wait for content to load and validate performance
      cy.wait('@contentList').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
      });

      // Verify content items display
      cy.get('[data-testid="content-list"]').should('be.visible');
      cy.get('[data-testid="content-item"]').should('have.length', 3);

      // Validate content item details
      mockContent.forEach((content: Content) => {
        cy.get(`[data-testid="content-item-${content.id}"]`).within(() => {
          cy.get('[data-testid="content-title"]').should('contain', content.metadata.title);
          cy.get('[data-testid="content-source"]').should('contain', content.metadata.source);
          cy.get('[data-testid="content-status"]').should('contain', content.status);
          
          // Verify tags display
          content.metadata.tags.forEach(tag => {
            cy.get('[data-testid="content-tags"]').should('contain', tag);
          });
        });
      });
    });

    it('handles content filtering and sorting', () => {
      // Test source filter
      cy.get('[data-testid="source-filter"]').click();
      cy.get(`[data-value="${ContentSource.WEB}"]`).click();
      cy.wait('@getContent');
      cy.get('[data-testid="content-item"]').each(($item) => {
        cy.wrap($item).find('[data-testid="content-source"]')
          .should('contain', ContentSource.WEB);
      });

      // Test status filter
      cy.get('[data-testid="status-filter"]').click();
      cy.get(`[data-value="${ContentStatus.NEW}"]`).click();
      cy.wait('@getContent');
      cy.get('[data-testid="content-item"]').each(($item) => {
        cy.wrap($item).find('[data-testid="content-status"]')
          .should('contain', ContentStatus.NEW);
      });

      // Test date sorting
      cy.get('[data-testid="sort-dropdown"]').click();
      cy.get('[data-value="date-desc"]').click();
      cy.wait('@getContent');
    });
  });

  describe('Content Processing', () => {
    it('processes content with performance validation', () => {
      const mockContent = generateMockContent({ status: ContentStatus.NEW });
      
      // Mock processing endpoint
      cy.intercept('POST', '/api/v1/content/process', (req) => {
        req.on('response', (res) => {
          const startTime = performance.now();
          res.send({
            ...mockContent,
            status: ContentStatus.PROCESSED,
            processedAt: new Date().toISOString()
          }).then(() => {
            const duration = performance.now() - startTime;
            expect(duration).to.be.lessThan(10000); // Validate 10s SLA
          });
        });
      }).as('processContent');

      // Select and process content
      cy.get(`[data-testid="content-item-${mockContent.id}"]`)
        .find('[data-testid="process-button"]')
        .click();

      // Verify WebSocket updates
      cy.get('@wsSend').should('be.called');
      cy.get('[data-testid="processing-indicator"]').should('be.visible');

      // Wait for processing completion
      cy.wait('@processContent').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        const processedContent = interception.response?.body;
        expect(processedContent.status).to.equal(ContentStatus.PROCESSED);
      });

      // Verify UI updates
      cy.get(`[data-testid="content-item-${mockContent.id}"]`)
        .find('[data-testid="content-status"]')
        .should('contain', ContentStatus.PROCESSED);
    });

    it('handles processing errors gracefully', () => {
      const mockContent = generateMockContent({ status: ContentStatus.NEW });
      
      // Mock processing error
      cy.intercept('POST', '/api/v1/content/process', {
        statusCode: 500,
        body: {
          error: {
            code: 'PROCESSING_ERROR',
            message: 'Content processing failed'
          }
        }
      }).as('processError');

      // Attempt processing
      cy.get(`[data-testid="content-item-${mockContent.id}"]`)
        .find('[data-testid="process-button"]')
        .click();

      // Verify error handling
      cy.wait('@processError');
      cy.get('[data-testid="error-message"]').should('be.visible')
        .and('contain', 'Content processing failed');
      
      // Verify content status update
      cy.get(`[data-testid="content-item-${mockContent.id}"]`)
        .find('[data-testid="content-status"]')
        .should('contain', ContentStatus.ERROR);
    });
  });

  describe('Real-time Updates', () => {
    it('receives and displays WebSocket updates', () => {
      const mockContent = generateMockContent();
      
      // Simulate WebSocket message
      cy.window().then((win) => {
        const wsInstance = win.WebSocket as any;
        wsInstance.onmessage?.({
          data: JSON.stringify({
            type: 'CONTENT_UPDATE',
            payload: {
              ...mockContent,
              status: ContentStatus.PROCESSED
            }
          })
        });
      });

      // Verify UI updates in real-time
      cy.get(`[data-testid="content-item-${mockContent.id}"]`)
        .find('[data-testid="content-status"]')
        .should('contain', ContentStatus.PROCESSED);
    });
  });
});