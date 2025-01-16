import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import CardEditor from '../../../../src/components/cards/CardEditor';
import { generateMockCard } from '../../utils/testHelpers';
import cardService from '../../../../src/services/cardService';
import { validateCardContent } from '../../../../src/utils/validation';
import { STUDY_MODES } from '../../../../src/constants/study';
import { ContentType } from '../../../../src/types/card';

expect.extend(toHaveNoViolations);

describe('CardEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnAIGenerate = vi.fn();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    vi.spyOn(cardService, 'createCard').mockResolvedValue(generateMockCard());
    vi.spyOn(cardService, 'updateCard').mockResolvedValue(generateMockCard());
    vi.spyOn(cardService, 'generateWithAI').mockResolvedValue(generateMockCard());
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      expect(screen.getByRole('textbox', { name: /front side/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /back side/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /tags/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const firstInput = screen.getByRole('textbox', { name: /front side/i });
      firstInput.focus();
      expect(document.activeElement).toBe(firstInput);

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /back side/i }));
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      await user.click(screen.getByRole('button', { name: /create card/i }));
      
      expect(screen.getByText(/front side is required/i)).toBeInTheDocument();
      expect(screen.getByText(/back side is required/i)).toBeInTheDocument();
    });

    it('should enforce content length limits', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const longText = 'a'.repeat(5001);
      await user.type(screen.getByRole('textbox', { name: /front side/i }), longText);
      
      expect(screen.getByText(/content exceeds maximum length/i)).toBeInTheDocument();
    });

    it('should validate tag format and limits', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const tagsInput = screen.getByRole('textbox', { name: /tags/i });
      await user.type(tagsInput, 'tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11');
      
      expect(screen.getByText(/maximum 10 tags allowed/i)).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('should sanitize input to prevent XSS attacks', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const maliciousScript = '<script>alert("xss")</script>';
      await user.type(screen.getByRole('textbox', { name: /front side/i }), maliciousScript);
      
      const sanitizedValue = screen.getByRole('textbox', { name: /front side/i }).getAttribute('value');
      expect(sanitizedValue).not.toContain('<script>');
    });

    it('should validate content against allowed HTML tags', async () => {
      const mockCard = generateMockCard({
        frontContent: {
          text: '<p>Safe HTML</p><iframe src="malicious.com"></iframe>',
          type: ContentType.HTML,
          metadata: {},
          sourceUrl: '',
          aiGenerated: false
        }
      });

      render(<CardEditor card={mockCard} onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const content = screen.getByRole('textbox', { name: /front side/i }).getAttribute('value');
      expect(content).toContain('<p>');
      expect(content).not.toContain('<iframe>');
    });
  });

  describe('AI Integration', () => {
    it('should trigger AI generation when enabled', async () => {
      render(
        <CardEditor 
          onSave={mockOnSave} 
          onCancel={mockOnCancel} 
          aiAssisted={true}
          onAIGenerate={mockOnAIGenerate}
        />
      );
      
      await user.type(screen.getByRole('textbox', { name: /front side/i }), 'Test content');
      
      await waitFor(() => {
        expect(mockOnAIGenerate).toHaveBeenCalledWith('Test content');
      });
    });

    it('should handle AI generation errors gracefully', async () => {
      mockOnAIGenerate.mockRejectedValue(new Error('AI generation failed'));
      
      render(
        <CardEditor 
          onSave={mockOnSave} 
          onCancel={mockOnCancel} 
          aiAssisted={true}
          onAIGenerate={mockOnAIGenerate}
        />
      );
      
      await user.type(screen.getByRole('textbox', { name: /front side/i }), 'Test content');
      
      await waitFor(() => {
        expect(screen.getByText(/failed to generate card content/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should populate form with existing card data', () => {
      const mockCard = generateMockCard({
        frontContent: { text: 'Front Test', type: ContentType.TEXT, metadata: {}, sourceUrl: '', aiGenerated: false },
        backContent: { text: 'Back Test', type: ContentType.TEXT, metadata: {}, sourceUrl: '', aiGenerated: false },
        tags: ['tag1', 'tag2']
      });

      render(<CardEditor card={mockCard} onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      expect(screen.getByRole('textbox', { name: /front side/i })).toHaveValue('Front Test');
      expect(screen.getByRole('textbox', { name: /back side/i })).toHaveValue('Back Test');
      expect(screen.getByRole('textbox', { name: /tags/i })).toHaveValue('tag1, tag2');
    });

    it('should handle card updates correctly', async () => {
      const mockCard = generateMockCard();
      
      render(<CardEditor card={mockCard} onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      await user.clear(screen.getByRole('textbox', { name: /front side/i }));
      await user.type(screen.getByRole('textbox', { name: /front side/i }), 'Updated Front');
      
      await user.click(screen.getByRole('button', { name: /update card/i }));
      
      expect(cardService.updateCard).toHaveBeenCalledWith(mockCard.id, expect.objectContaining({
        frontContent: expect.objectContaining({ text: 'Updated Front' })
      }));
    });
  });

  describe('Study Mode Compatibility', () => {
    it('should allow selection of compatible study modes', async () => {
      render(<CardEditor onSave={mockOnSave} onCancel={mockOnCancel} />);
      
      const voiceCheckbox = screen.getByRole('checkbox', { name: new RegExp(STUDY_MODES.VOICE, 'i') });
      await user.click(voiceCheckbox);
      
      await user.type(screen.getByRole('textbox', { name: /front side/i }), 'Test content');
      await user.type(screen.getByRole('textbox', { name: /back side/i }), 'Test answer');
      
      await user.click(screen.getByRole('button', { name: /create card/i }));
      
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        compatibleModes: expect.arrayContaining([STUDY_MODES.VOICE])
      }));
    });
  });
});