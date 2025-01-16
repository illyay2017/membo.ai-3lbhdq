/**
 * A secure and accessible form component for creating and editing flashcards
 * with support for front/back content, tags, study mode compatibility, and AI-assisted generation
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import xss from 'xss';

import { Card, CardContent } from '../../types/card';
import cardService from '../../services/cardService';
import Input from '../ui/input';
import { sanitizeInput } from '../../utils/validation';
import { STUDY_MODES } from '../../constants/study';

interface CardEditorProps {
  card?: Card;
  contentId?: string;
  onSave: (card: Card) => void;
  onCancel: () => void;
  aiAssisted?: boolean;
  onAIGenerate?: (content: string) => Promise<Card>;
}

interface CardFormData {
  frontContent: string;
  backContent: string;
  tags: string[];
  compatibleModes: STUDY_MODES[];
}

const DEBOUNCE_DELAY = 500;
const MAX_CONTENT_LENGTH = 5000;
const MAX_TAGS = 10;

export const CardEditor: React.FC<CardEditorProps> = ({
  card,
  contentId,
  onSave,
  onCancel,
  aiAssisted = false,
  onAIGenerate
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<CardFormData>({
    defaultValues: {
      frontContent: card?.frontContent.text || '',
      backContent: card?.backContent.text || '',
      tags: card?.tags || [],
      compatibleModes: card?.compatibleModes || [STUDY_MODES.STANDARD]
    }
  });

  // Debounced AI generation handler
  const debouncedAIGenerate = useCallback(
    debounce(async (content: string) => {
      if (!aiAssisted || !onAIGenerate || content.length < 10) return;

      try {
        setIsProcessing(true);
        setAIError(null);
        const generatedCard = await onAIGenerate(content);
        setValue('backContent', generatedCard.backContent.text, { shouldDirty: true });
      } catch (error) {
        setAIError('Failed to generate card content');
        toast.error('AI generation failed. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }, DEBOUNCE_DELAY),
    [onAIGenerate, setValue]
  );

  // Watch front content for AI generation
  const frontContent = watch('frontContent');
  useEffect(() => {
    if (aiAssisted && frontContent) {
      debouncedAIGenerate(frontContent);
    }
  }, [frontContent, debouncedAIGenerate, aiAssisted]);

  const onSubmit = async (formData: CardFormData) => {
    try {
      setIsProcessing(true);

      // Sanitize all input data
      const sanitizedData = {
        frontContent: {
          text: sanitizeInput(formData.frontContent),
          type: 'text' as const,
          metadata: {},
          sourceUrl: '',
          aiGenerated: false
        },
        backContent: {
          text: sanitizeInput(formData.backContent),
          type: 'text' as const,
          metadata: {},
          sourceUrl: '',
          aiGenerated: aiAssisted
        },
        tags: formData.tags.map(tag => sanitizeInput(tag)),
        compatibleModes: formData.compatibleModes,
        contentId
      };

      // Create or update card
      const savedCard = card
        ? await cardService.updateCard(card.id, sanitizedData)
        : await cardService.createCard(sanitizedData);

      toast.success(card ? 'Card updated successfully' : 'Card created successfully');
      onSave(savedCard);
    } catch (error) {
      toast.error('Failed to save card. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4 relative">
      {/* Front Content */}
      <Input
        id="frontContent"
        name="frontContent"
        label="Front Side"
        value={watch('frontContent')}
        error={errors.frontContent?.message}
        onChange={(value) => setValue('frontContent', value, { shouldDirty: true })}
        maxLength={MAX_CONTENT_LENGTH}
        required
        aria-label="Card front content"
      />

      {/* Back Content */}
      <Input
        id="backContent"
        name="backContent"
        label="Back Side"
        value={watch('backContent')}
        error={errors.backContent?.message}
        onChange={(value) => setValue('backContent', value, { shouldDirty: true })}
        maxLength={MAX_CONTENT_LENGTH}
        required
        aria-label="Card back content"
        disabled={isProcessing && aiAssisted}
      />

      {/* Tags Input */}
      <Input
        id="tags"
        name="tags"
        label="Tags"
        value={watch('tags').join(', ')}
        onChange={(value) => {
          const tags = value.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .slice(0, MAX_TAGS);
          setValue('tags', tags, { shouldDirty: true });
        }}
        placeholder="Enter tags separated by commas"
        aria-label="Card tags"
      />

      {/* Study Modes */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Compatible Study Modes
        </label>
        <div className="flex gap-4">
          {Object.values(STUDY_MODES).map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={watch('compatibleModes').includes(mode)}
                onChange={(e) => {
                  const modes = e.target.checked
                    ? [...watch('compatibleModes'), mode]
                    : watch('compatibleModes').filter(m => m !== mode);
                  setValue('compatibleModes', modes, { shouldDirty: true });
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">{mode}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {aiError && (
        <div role="alert" className="text-sm text-red-500">
          {aiError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing || !isDirty}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Saving...' : card ? 'Update Card' : 'Create Card'}
        </button>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}
    </form>
  );
};

export default CardEditor;