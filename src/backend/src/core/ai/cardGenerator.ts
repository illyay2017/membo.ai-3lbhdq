import { OpenAIApi } from 'openai'; // version: ^4.0.0
import Redis from 'ioredis'; // version: ^5.0.0
import winston from 'winston'; // version: ^3.0.0
import { ICard, ContentType, ICardContent } from '../../interfaces/ICard';
import { IContent, ContentStatus } from '../../interfaces/IContent';
import { StudyModes } from '../../constants/studyModes';
import { openai, DEFAULT_MODEL, REQUEST_TIMEOUT } from '../../config/openai';
import { validateSchema } from '../../utils/validation';

// Constants for card generation
const CARD_GENERATION_PROMPT = `Generate comprehensive flashcards from the following content. For each card:
1. Create clear, concise front content focusing on key concepts
2. Provide detailed back content with complete explanations
3. Use appropriate formatting and structure
4. Maintain context and accuracy

Content to process:`;

const MAX_CONTENT_LENGTH = 4000;
const MIN_CONTENT_LENGTH = 10;
const API_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const CACHE_TTL = 3600; // 1 hour in seconds

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'card-generator' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Interfaces for card generation
interface GenerationOptions {
  maxCards?: number;
  preferredTypes?: ContentType[];
  targetModes?: StudyModes[];
  language?: string;
}

interface GenerationMetrics {
  processingTime: number;
  tokenCount: number;
  cardCount: number;
  cacheHit: boolean;
}

@injectable()
class CardGenerator {
  private metrics: GenerationMetrics;

  constructor(
    private openaiClient: OpenAIApi,
    private cacheClient: Redis,
    private options: GenerationOptions = {}
  ) {
    this.metrics = {
      processingTime: 0,
      tokenCount: 0,
      cardCount: 0,
      cacheHit: false,
    };
  }

  /**
   * Generates flashcards from provided content using AI processing
   */
  public async generateFromContent(content: IContent): Promise<ICard[]> {
    try {
      // Check cache first
      const cacheKey = `cards:${content.id}`;
      const cachedCards = await this.cacheClient.get(cacheKey);
      
      if (cachedCards) {
        this.metrics.cacheHit = true;
        return JSON.parse(cachedCards);
      }

      // Validate content
      this.validateContent(content);

      // Check content moderation
      await this.moderateContent(content.content);

      // Generate cards
      const startTime = Date.now();
      const cards = await this.processContentWithAI(content);
      this.metrics.processingTime = Date.now() - startTime;

      // Validate generated cards
      if (!this.validateGeneratedCards(cards)) {
        throw new Error('Generated cards failed validation');
      }

      // Cache successful generation
      await this.cacheClient.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(cards)
      );

      // Update metrics
      this.metrics.cardCount = cards.length;
      
      return cards;
    } catch (error) {
      logger.error('Card generation failed', {
        contentId: content.id,
        error: error.message,
        metrics: this.metrics,
      });
      throw error;
    }
  }

  /**
   * Validates input content before processing
   */
  private validateContent(content: IContent): void {
    if (!content.content || 
        content.content.length < MIN_CONTENT_LENGTH || 
        content.content.length > MAX_CONTENT_LENGTH) {
      throw new Error('Content length out of acceptable range');
    }

    const validationResult = validateSchema(
      content,
      {
        content: 'required|string',
        metadata: 'required|object',
        source: 'required|string',
      }
    );

    if (!validationResult.isValid) {
      throw new Error(`Content validation failed: ${validationResult.errors[0]?.message}`);
    }
  }

  /**
   * Checks content against OpenAI's moderation endpoint
   */
  private async moderateContent(text: string): Promise<void> {
    const moderation = await this.openaiClient.createModeration({
      input: text,
    });

    if (moderation.data.results[0].flagged) {
      throw new Error('Content flagged by moderation check');
    }
  }

  /**
   * Processes content using OpenAI API to generate cards
   */
  private async processContentWithAI(content: IContent): Promise<ICard[]> {
    let attempt = 0;
    
    while (attempt < MAX_RETRIES) {
      try {
        const completion = await this.openaiClient.createChatCompletion({
          model: DEFAULT_MODEL,
          messages: [
            {
              role: 'system',
              content: CARD_GENERATION_PROMPT,
            },
            {
              role: 'user',
              content: content.content,
            },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          timeout: API_TIMEOUT,
        });

        const cards = this.parseAIResponse(completion.data.choices[0].message.content, content);
        this.metrics.tokenCount = completion.data.usage.total_tokens;
        
        return cards;
      } catch (error) {
        attempt++;
        if (attempt === MAX_RETRIES) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Failed to process content after max retries');
  }

  /**
   * Parses AI response into structured card format
   */
  private parseAIResponse(response: string, content: IContent): ICard[] {
    const cards: ICard[] = [];
    const parsedResponse = JSON.parse(response);

    for (const item of parsedResponse) {
      const card: ICard = {
        id: crypto.randomUUID(),
        userId: content.userId,
        contentId: content.id,
        frontContent: {
          text: item.front,
          type: ContentType.TEXT,
          metadata: {
            sourceUrl: content.sourceUrl,
            aiGenerated: true,
            generationPrompt: CARD_GENERATION_PROMPT,
            lastModifiedBy: 'system',
          },
        },
        backContent: {
          text: item.back,
          type: ContentType.TEXT,
          metadata: {
            sourceUrl: content.sourceUrl,
            aiGenerated: true,
            generationPrompt: CARD_GENERATION_PROMPT,
            lastModifiedBy: 'system',
          },
        },
        compatibleModes: this.determineCompatibleModes(item),
        tags: content.metadata.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      cards.push(card);
    }

    return cards;
  }

  /**
   * Determines which study modes are compatible with the card
   */
  private determineCompatibleModes(card: any): StudyModes[] {
    const modes: StudyModes[] = [StudyModes.STANDARD];

    // Check voice mode compatibility
    if (this.isVoiceCompatible(card)) {
      modes.push(StudyModes.VOICE);
    }

    // Check quiz mode compatibility
    if (this.isQuizCompatible(card)) {
      modes.push(StudyModes.QUIZ);
    }

    return modes;
  }

  /**
   * Checks if card is compatible with voice mode
   */
  private isVoiceCompatible(card: any): boolean {
    return (
      card.front.length < 200 &&
      card.back.length < 500 &&
      !card.front.includes('```') &&
      !card.back.includes('```')
    );
  }

  /**
   * Checks if card is compatible with quiz mode
   */
  private isQuizCompatible(card: any): boolean {
    return (
      card.back.length > 50 &&
      card.back.length < 1000 &&
      !card.front.includes('```')
    );
  }

  /**
   * Validates generated cards meet quality standards
   */
  private validateGeneratedCards(cards: ICard[]): boolean {
    if (!Array.isArray(cards) || cards.length === 0) {
      return false;
    }

    return cards.every(card => {
      return (
        card.frontContent?.text?.length > 0 &&
        card.backContent?.text?.length > 0 &&
        card.compatibleModes?.length > 0 &&
        Array.isArray(card.tags)
      );
    });
  }

  /**
   * Returns current generation metrics
   */
  public getMetrics(): GenerationMetrics {
    return this.metrics;
  }
}

// Export the card generator class and standalone function
export { CardGenerator };

export const generateCards = async (
  content: IContent,
  options?: GenerationOptions
): Promise<ICard[]> => {
  const generator = new CardGenerator(openai, new Redis(process.env.REDIS_URL), options);
  return generator.generateFromContent(content);
};