/**
 * End-to-end tests for study session functionality
 * Tests standard and voice-enabled study modes, card interactions,
 * performance tracking, analytics, and offline capabilities
 * @version 1.0.0
 */

import { STUDY_MODES, CONFIDENCE_LEVELS } from '../../src/constants/study';
import { VoiceRecognitionState } from '../../src/types/voice';

describe('Study Session E2E Tests', () => {
  beforeEach(() => {
    // Reset database state
    cy.task('db:reset');

    // Seed test data
    cy.fixture('testCards').then((cards) => {
      cy.task('db:seed', { cards });
    });

    // Mock authentication
    cy.fixture('testUser').then((user) => {
      cy.login(user);
    });

    // Mock WebSocket connection
    cy.mockWebSocket();

    // Mock voice recognition service
    cy.mockVoiceRecognition();

    // Visit study page
    cy.visit('/study');
    cy.wait('@getStudySession');
  });

  describe('Standard Study Mode', () => {
    it('should initialize study session with correct configuration', () => {
      cy.get('[data-testid="study-header"]').should('be.visible');
      cy.get('[data-testid="study-progress"]').should('contain', '0/20');
      cy.get('[data-testid="study-streak"]').should('be.visible');
      cy.get('[data-testid="card-display"]').should('be.visible');
    });

    it('should display card content and handle reveal', () => {
      // Check initial card state
      cy.get('[data-testid="card-front"]').should('be.visible');
      cy.get('[data-testid="card-back"]').should('not.exist');

      // Reveal answer
      cy.get('[data-testid="show-answer"]').click();
      cy.get('[data-testid="card-back"]').should('be.visible');
      cy.get('[data-testid="confidence-buttons"]').should('be.visible');
    });

    it('should handle confidence rating submission', () => {
      // Reveal answer
      cy.get('[data-testid="show-answer"]').click();

      // Submit confidence rating
      cy.get('[data-analytics-id="confidence_good"]').click();
      cy.wait('@submitReview');

      // Verify progress update
      cy.get('[data-testid="study-progress"]').should('contain', '1/20');
      cy.get('[data-testid="performance-metrics"]')
        .should('contain', 'Retention:')
        .and('contain', 'Average Confidence:');
    });

    it('should track study streak and performance', () => {
      // Complete multiple reviews
      for (let i = 0; i < 3; i++) {
        cy.get('[data-testid="show-answer"]').click();
        cy.get('[data-analytics-id="confidence_good"]').click();
        cy.wait('@submitReview');
      }

      // Verify performance metrics
      cy.get('[data-testid="study-streak"]').should('not.contain', '0');
      cy.get('[data-testid="retention-rate"]').should('contain', '100%');
    });

    it('should handle offline mode gracefully', () => {
      // Simulate offline state
      cy.goOffline();

      // Attempt review
      cy.get('[data-testid="show-answer"]').click();
      cy.get('[data-analytics-id="confidence_good"]').click();

      // Verify offline indicators
      cy.get('[data-testid="offline-mode"]').should('be.visible');
      cy.get('[data-testid="sync-status"]').should('contain', 'Pending sync');

      // Restore online state
      cy.goOnline();
      cy.get('[data-testid="sync-now"]').click();
      cy.wait('@syncStudyData');
      cy.get('[data-testid="offline-mode"]').should('not.exist');
    });
  });

  describe('Voice-Enabled Study Mode', () => {
    beforeEach(() => {
      // Enable voice mode
      cy.get('[data-testid="voice-toggle"]').click();
      cy.wait('@initializeVoice');
    });

    it('should handle voice mode activation', () => {
      cy.get('[data-testid="voice-controls"]').should('be.visible');
      cy.get('[data-testid="voice-status"]')
        .should('have.attr', 'aria-label')
        .and('contain', 'Voice recognition active');
    });

    it('should process voice input correctly', () => {
      // Start voice recognition
      cy.get('[data-testid="start-voice"]').click();

      // Simulate voice input
      cy.mockVoiceResult({
        transcript: 'Test answer',
        confidence: 0.9,
        isFinal: true
      });

      // Verify processing
      cy.get('[data-testid="voice-transcript"]').should('contain', 'Test answer');
      cy.wait('@processVoice');
      cy.get('[data-testid="confidence-indicator"]')
        .should('have.attr', 'aria-valuenow', '90');
    });

    it('should handle voice recognition errors', () => {
      // Simulate error state
      cy.mockVoiceError({
        code: 'no-speech',
        message: 'No speech detected'
      });

      // Verify error handling
      cy.get('[data-testid="voice-error"]').should('be.visible');
      cy.get('[data-testid="retry-voice"]').click();
      cy.wait('@initializeVoice');
    });

    it('should maintain performance tracking in voice mode', () => {
      // Complete voice-based reviews
      for (let i = 0; i < 3; i++) {
        cy.mockVoiceResult({
          transcript: 'Correct answer',
          confidence: 0.95,
          isFinal: true
        });
        cy.wait('@processVoice');
        cy.wait('@submitReview');
      }

      // Verify metrics
      cy.get('[data-testid="voice-accuracy"]').should('contain', '95%');
      cy.get('[data-testid="study-progress"]').should('contain', '3/20');
    });
  });

  describe('Analytics and Performance', () => {
    it('should track comprehensive study metrics', () => {
      // Complete mixed mode reviews
      cy.completeReviews([
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.GOOD },
        { mode: 'voice', transcript: 'Test answer', confidence: 0.9 },
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.EASY }
      ]);

      // Verify analytics
      cy.get('[data-testid="performance-metrics"]').within(() => {
        cy.get('[data-testid="retention-rate"]').should('not.contain', '0%');
        cy.get('[data-testid="average-confidence"]').should('not.contain', '0%');
        cy.get('[data-testid="study-streak"]').should('not.contain', '0');
      });
    });

    it('should persist study progress across sessions', () => {
      // Complete initial reviews
      cy.completeReviews([
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.GOOD },
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.GOOD }
      ]);

      // Reload page
      cy.reload();
      cy.wait('@getStudySession');

      // Verify persisted progress
      cy.get('[data-testid="study-progress"]').should('contain', '2/20');
      cy.get('[data-testid="retention-rate"]').should('not.contain', '0%');
    });

    it('should handle session completion', () => {
      // Mock shorter session length
      cy.mockStudySettings({ cardsPerSession: 2 });

      // Complete session
      cy.completeReviews([
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.GOOD },
        { mode: 'standard', confidence: CONFIDENCE_LEVELS.GOOD }
      ]);

      // Verify completion state
      cy.get('[data-testid="session-complete"]').should('be.visible');
      cy.get('[data-testid="session-summary"]').within(() => {
        cy.get('[data-testid="total-cards"]').should('contain', '2');
        cy.get('[data-testid="accuracy-rate"]').should('contain', '100%');
        cy.get('[data-testid="study-time"]').should('be.visible');
      });
    });
  });
});

// Custom commands for test helpers
Cypress.Commands.add('mockWebSocket', () => {
  cy.window().then((win) => {
    win.WebSocket = class MockWebSocket {
      constructor() {
        setTimeout(() => this.onopen(), 100);
      }
      send() {}
      close() {}
    };
  });
});

Cypress.Commands.add('mockVoiceRecognition', () => {
  cy.window().then((win) => {
    win.SpeechRecognition = class MockSpeechRecognition {
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
    };
  });
});

Cypress.Commands.add('completeReviews', (reviews) => {
  reviews.forEach((review) => {
    if (review.mode === 'standard') {
      cy.get('[data-testid="show-answer"]').click();
      cy.get(`[data-analytics-id="confidence_${review.confidence}"]`).click();
      cy.wait('@submitReview');
    } else {
      cy.mockVoiceResult({
        transcript: review.transcript,
        confidence: review.confidence,
        isFinal: true
      });
      cy.wait('@processVoice');
      cy.wait('@submitReview');
    }
  });
});

Cypress.Commands.add('goOffline', () => {
  cy.window().then((win) => {
    win.navigator.onLine = false;
    win.dispatchEvent(new Event('offline'));
  });
});

Cypress.Commands.add('goOnline', () => {
  cy.window().then((win) => {
    win.navigator.onLine = true;
    win.dispatchEvent(new Event('online'));
  });
});