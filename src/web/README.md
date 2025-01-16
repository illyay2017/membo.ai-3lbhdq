# membo.ai Web Application

Comprehensive documentation for membo.ai's web-based personal knowledge retention system featuring AI-powered flashcard generation and voice-enabled learning.

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git
- Docker (optional, for containerized development)
- Chrome browser (latest version for extension development)
- Microphone access for voice feature development

## Getting Started

### Clone Repository
```bash
git clone https://github.com/yourusername/membo-web.git
cd membo-web
```

### Environment Setup
1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure required environment variables:
```env
VITE_API_URL=http://localhost:4000
VITE_OPENAI_API_KEY=your_openai_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_ENABLE_VOICE=true
```

3. Install dependencies:
```bash
npm install
```

4. Generate local SSL certificates (required for voice features):
```bash
npm run generate-certs
```

## Available Scripts

- `npm run dev` - Start development server with hot reload enabled
- `npm run build` - Create optimized production build
- `npm run preview` - Preview production build locally
- `npm run test` - Run Jest unit tests with coverage
- `npm run test:e2e` - Execute Cypress E2E tests
- `npm run test:voice` - Run voice processing integration tests
- `npm run lint` - Run ESLint with project-specific rules
- `npm run format` - Format code using Prettier
- `npm run analyze` - Analyze bundle size and dependencies
- `npm run storybook` - Run Storybook for component development

## Project Structure

```
src/
├── components/          # Reusable React components
├── pages/              # Application route components
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── store/              # Zustand state management
├── styles/             # Global styles and Tailwind configuration
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── ai/                 # AI processing utilities
├── voice/              # Voice processing components
└── tests/              # Test suites and fixtures
```

## Development Guidelines

### Code Style and Standards
- Follow ESLint configuration in `.eslintrc.js`
- Use Prettier for code formatting
- Maintain 100% TypeScript strict mode compliance
- Follow React hooks best practices
- Implement error boundaries for component error handling

### Component Development
- Use functional components with hooks
- Implement proper prop-types or TypeScript interfaces
- Follow atomic design principles
- Include Storybook documentation
- Ensure accessibility compliance (WCAG 2.1)

### AI Integration
- Implement rate limiting for API calls
- Handle API errors gracefully
- Cache responses when appropriate
- Follow OpenAI best practices
- Implement fallback mechanisms

### Voice Processing
- Test microphone access before activation
- Implement noise cancellation
- Handle browser compatibility issues
- Provide visual feedback during processing
- Implement error recovery mechanisms

### State Management
- Use Zustand for global state
- Implement proper state persistence
- Handle loading and error states
- Follow immutability principles
- Document state shape and mutations

### Testing Requirements
- Maintain >80% test coverage
- Include unit tests for utilities
- Implement integration tests for API calls
- Add E2E tests for critical paths
- Test voice processing features

## Build and Deployment

### Production Build
```bash
npm run build
```

### Environment Configuration
- Set NODE_ENV=production
- Configure CDN endpoints
- Set up error tracking
- Enable production logging
- Configure SSL certificates

### Performance Optimization
- Enable code splitting
- Implement lazy loading
- Configure service workers
- Optimize asset caching
- Monitor bundle size

### Security Measures
- Implement CSP headers
- Enable CORS protection
- Set up rate limiting
- Configure SSL/TLS
- Implement API authentication

## Troubleshooting

### Common Issues

#### Development Server
- Port conflicts: Change port in vite.config.ts
- SSL errors: Regenerate certificates
- Hot reload issues: Clear browser cache

#### Voice Processing
- Microphone access denied: Check browser permissions
- Audio quality issues: Adjust noise cancellation
- Processing delays: Check network connection

#### AI Integration
- API rate limits: Implement request queuing
- Response timeout: Adjust timeout settings
- Invalid responses: Validate API key configuration

#### Build Problems
- Memory issues: Increase Node.js memory limit
- Module resolution: Check tsconfig.json paths
- Asset optimization: Verify build configuration

For additional support, please refer to our [GitHub Issues](https://github.com/yourusername/membo-web/issues) or contact the development team.