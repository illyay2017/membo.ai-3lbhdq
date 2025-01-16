import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import AppShell from '../../components/layout/AppShell';
import CardEditor from '../../components/cards/CardEditor';
import { Card } from '../../types/card';
import cardService from '../../services/cardService';
import useAuth from '../../hooks/useAuth';

interface CardCreationPageProps {
  contentId?: string;
  initialContent?: string;
}

const CardCreationPage: React.FC<CardCreationPageProps> = ({
  contentId,
  initialContent
}) => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has AI generation privileges
  const canUseAI = userRole !== 'FREE_USER';

  // Handle card save with validation and error handling
  const handleCardSave = useCallback(async (card: Card) => {
    try {
      setIsLoading(true);
      setError(null);

      const savedCard = await cardService.createCard({
        frontContent: card.frontContent,
        backContent: card.backContent,
        tags: card.tags,
        compatibleModes: card.compatibleModes,
        contentId: contentId
      });

      toast.success('Card created successfully');
      navigate(`/cards/${savedCard.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create card';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [contentId, navigate]);

  // Handle AI-assisted card generation
  const handleAIGenerate = useCallback(async (content: string): Promise<Card> => {
    if (!canUseAI) {
      throw new Error('AI generation requires a Pro or Power user subscription');
    }

    try {
      const [generatedCard] = await cardService.generateAICards(content, {
        type: 'standard',
        count: 1,
        tags: []
      });
      return generatedCard;
    } catch (error) {
      throw new Error('Failed to generate card content using AI');
    }
  }, [canUseAI]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    navigate('/cards');
  }, [navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsLoading(false);
      setError(null);
    };
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create New Card</h1>
          {canUseAI && (
            <span className="text-sm text-gray-500">
              AI-assisted generation available
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div 
            role="alert" 
            className="text-red-500 text-sm mt-2"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* Card Editor */}
        <div className="flex-1 overflow-auto">
          <CardEditor
            contentId={contentId}
            onSave={handleCardSave}
            onCancel={handleCancel}
            aiAssisted={canUseAI}
            onAIGenerate={handleAIGenerate}
          />
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div 
            className="absolute inset-0 bg-white/80 flex items-center justify-center"
            role="progressbar"
            aria-busy="true"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CardCreationPage;