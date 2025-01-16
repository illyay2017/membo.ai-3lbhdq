import { rest } from 'msw';
import { LoginCredentials, RegisterCredentials } from '../../src/types/auth';
import { Card } from '../../src/types/card';
import { Content, ContentStatus } from '../../src/types/content';

// Mock user data for testing
const MOCK_USER = {
  id: 'mock-user-id',
  email: 'test@membo.ai',
  firstName: 'Test',
  lastName: 'User',
  subscription: 'free',
  isEmailVerified: true,
  role: 'FREE_USER'
} as const;

// Mock authentication tokens
const MOCK_TOKENS = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 1800 // 30 minutes
} as const;

// Rate limiting configuration (requests per minute)
const RATE_LIMITS = {
  free: 100,
  pro: 1000,
  resetInterval: 60000 // 1 minute
} as const;

// Simulated response delays (ms)
const SIMULATED_DELAYS = {
  min: 50,
  max: 200,
  error: 500
} as const;

// Rate limiting state
const rateLimitState = new Map<string, { count: number; resetTime: number }>();

// Utility function to simulate network delay
const simulateDelay = async (isError = false): Promise<void> => {
  const delay = isError ? 
    SIMULATED_DELAYS.error : 
    Math.floor(Math.random() * (SIMULATED_DELAYS.max - SIMULATED_DELAYS.min) + SIMULATED_DELAYS.min);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Utility function to check rate limits
const checkRateLimit = (userId: string, userRole: string): boolean => {
  const now = Date.now();
  const state = rateLimitState.get(userId) || { count: 0, resetTime: now + RATE_LIMITS.resetInterval };
  
  if (now > state.resetTime) {
    state.count = 0;
    state.resetTime = now + RATE_LIMITS.resetInterval;
  }
  
  const limit = userRole === 'FREE_USER' ? RATE_LIMITS.free : RATE_LIMITS.pro;
  state.count++;
  rateLimitState.set(userId, state);
  
  return state.count <= limit;
};

// Authentication handlers
export const authHandlers = [
  // Login endpoint
  rest.post('/api/v1/auth/login', async (req, res, ctx) => {
    await simulateDelay();
    
    const { email, password } = await req.json<LoginCredentials>();
    
    if (email !== MOCK_USER.email || password !== 'correct-password') {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid credentials' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        user: MOCK_USER,
        tokens: MOCK_TOKENS
      })
    );
  }),

  // Registration endpoint
  rest.post('/api/v1/auth/register', async (req, res, ctx) => {
    await simulateDelay();
    
    const credentials = await req.json<RegisterCredentials>();
    
    if (credentials.email === MOCK_USER.email) {
      return res(
        ctx.status(409),
        ctx.json({ error: 'Email already registered' })
      );
    }
    
    return res(
      ctx.status(201),
      ctx.json({
        user: {
          ...MOCK_USER,
          email: credentials.email,
          firstName: credentials.firstName,
          lastName: credentials.lastName
        },
        tokens: MOCK_TOKENS
      })
    );
  }),

  // Token refresh endpoint
  rest.post('/api/v1/auth/refresh', async (req, res, ctx) => {
    await simulateDelay();
    
    const { refreshToken } = await req.json<{ refreshToken: string }>();
    
    if (refreshToken !== MOCK_TOKENS.refreshToken) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid refresh token' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        tokens: {
          ...MOCK_TOKENS,
          accessToken: 'new-access-token'
        }
      })
    );
  })
];

// Card management handlers
export const cardHandlers = [
  // Get cards endpoint
  rest.get('/api/v1/cards', async (req, res, ctx) => {
    await simulateDelay();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.includes(MOCK_TOKENS.accessToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Unauthorized' })
      );
    }
    
    if (!checkRateLimit(MOCK_USER.id, MOCK_USER.role)) {
      return res(
        ctx.status(429),
        ctx.json({ error: 'Rate limit exceeded' })
      );
    }
    
    const mockCards: Card[] = [
      {
        id: 'card-1',
        userId: MOCK_USER.id,
        contentId: 'content-1',
        frontContent: {
          text: 'What is FSRS?',
          type: 'text',
          metadata: {
            aiModel: 'gpt-4',
            generationPrompt: 'Create a card about FSRS',
            confidence: 0.95,
            processingTime: 150
          },
          sourceUrl: 'https://example.com/fsrs',
          aiGenerated: true
        },
        backContent: {
          text: 'Free Spaced Repetition Scheduler - An algorithm for optimizing review intervals',
          type: 'text',
          metadata: {
            aiModel: 'gpt-4',
            generationPrompt: 'Explain FSRS',
            confidence: 0.95,
            processingTime: 150
          },
          sourceUrl: 'https://example.com/fsrs',
          aiGenerated: true
        },
        fsrsData: {
          stability: 0.8,
          difficulty: 0.7,
          reviewCount: 1,
          lastReview: new Date(),
          lastRating: 3,
          performanceHistory: []
        },
        nextReview: new Date(),
        compatibleModes: ['standard', 'voice'],
        tags: ['algorithm', 'learning'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    return res(
      ctx.status(200),
      ctx.json(mockCards)
    );
  })
];

// Content management handlers
export const contentHandlers = [
  // Create content endpoint
  rest.post('/api/v1/content', async (req, res, ctx) => {
    await simulateDelay();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.includes(MOCK_TOKENS.accessToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Unauthorized' })
      );
    }
    
    if (!checkRateLimit(MOCK_USER.id, MOCK_USER.role)) {
      return res(
        ctx.status(429),
        ctx.json({ error: 'Rate limit exceeded' })
      );
    }
    
    const mockContent: Content = {
      id: 'content-1',
      userId: MOCK_USER.id,
      content: 'Sample content text',
      metadata: {
        title: 'Sample Content',
        author: 'Test Author',
        tags: ['test'],
        source: 'web',
        sourceUrl: 'https://example.com',
        pageNumber: null,
        chapterTitle: null,
        captureContext: {
          section: 'Main Content',
          highlight: 'Sample highlight'
        }
      },
      status: ContentStatus.NEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
      processingError: null
    };
    
    return res(
      ctx.status(201),
      ctx.json(mockContent)
    );
  })
];

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...cardHandlers,
  ...contentHandlers
];

export default handlers;