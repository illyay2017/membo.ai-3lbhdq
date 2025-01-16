# Contributing to membo.ai

Thank you for your interest in contributing to membo.ai! This document outlines the standards and processes for contributing to our personal knowledge retention system.

## Table of Contents
- [Introduction](#introduction)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Contribution Workflow](#contribution-workflow)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)
- [Review Process](#review-process)

## Introduction

membo.ai is a personal knowledge retention system that leverages AI and voice interaction to transform captured content into smart flashcards. We welcome contributions that enhance our core capabilities:

- Content capture and processing
- AI-powered card generation
- Voice-enabled study features
- Spaced repetition algorithms
- Performance optimization

## Development Setup

### Prerequisites

- Node.js 20.x LTS
- Docker 24.x
- GCP SDK
- OpenAI API access
- Supabase CLI

### Environment Configuration

1. **Local Database Setup**
```bash
# Initialize local Supabase
supabase init
supabase start

# Apply migrations
supabase db reset
```

2. **AI Model Configuration**
```bash
# Configure OpenAI credentials
cp .env.example .env
# Add your OpenAI API key to .env
```

3. **Voice Processing Setup**
```bash
# Install voice processing dependencies
npm install @react-native-voice/voice

# Configure language models
cp voice-config.example.json voice-config.json
```

4. **Test Environment**
```bash
# Install test dependencies
npm install --save-dev jest @testing-library/react @testing-library/react-native

# Run test suite
npm test
```

## Code Standards

### JavaScript/React Standards

- Use ESLint with provided configuration
- Format code using Prettier
- Follow React hooks guidelines
- Implement performance optimizations
- Ensure accessibility compliance

```javascript
// Example component structure
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

export const StudyCard = ({ content, onResponse }) => {
  // Implementation
};

StudyCard.propTypes = {
  content: PropTypes.object.isRequired,
  onResponse: PropTypes.func.isRequired
};
```

### AI/ML Components

- Follow model integration standards
- Meet performance benchmarks
- Implement proper data handling
- Validate model outputs

```javascript
// Example AI processing
const processContent = async (content) => {
  try {
    // Validation
    validateInput(content);
    
    // Processing
    const result = await aiService.process(content);
    
    // Output validation
    validateOutput(result);
    
    return result;
  } catch (error) {
    handleError(error);
  }
};
```

### Voice Processing

- Implement speech recognition standards
- Handle voice data securely
- Meet latency requirements
- Support multiple languages

```javascript
// Example voice handler
const handleVoiceInput = async (input) => {
  // Language detection
  const language = await detectLanguage(input);
  
  // Process input
  const result = await processVoiceInput(input, language);
  
  // Validate accuracy
  if (result.confidence < 0.85) {
    return requestRepeat();
  }
  
  return result;
};
```

## Contribution Workflow

1. Fork the repository
2. Create a feature branch
3. Implement changes
4. Add tests
5. Submit pull request

### Branch Naming

```
feature/description
bugfix/description
improvement/description
```

### Commit Messages

```
type(scope): description

- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting
- refactor: code restructuring
- test: adding tests
- chore: maintenance
```

## Testing Requirements

All contributions must include:

- Unit tests
- Integration tests
- E2E tests where applicable
- Performance benchmarks
- Accessibility tests

Minimum coverage requirements:
- Backend: 80%
- Frontend: 75%
- Mobile: 75%
- Voice Processing: 85%

## Security Guidelines

- Follow OWASP security practices
- Implement input validation
- Handle sensitive data appropriately
- Use secure dependencies
- Add security tests

## Review Process

### Required Approvals

- Backend changes: 2 approvals
- Frontend changes: 2 approvals
- Mobile changes: 2 approvals
- Infrastructure changes: 2 approvals
- AI changes: 2 approvals
- Study algorithm changes: 2 approvals
- Voice processing changes: 2 approvals

### Required Checks

All PRs must pass:
- ci-backend-tests
- ci-frontend-tests
- ci-mobile-tests
- security-scan
- lint-check
- type-check
- ai-model-validation
- voice-processing-tests
- performance-benchmark
- accessibility-check

## Issue Templates

Please use our templates when creating:
- Bug reports
- Feature requests
- Pull requests

## Questions?

Join our developer community on Discord or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the project's license.