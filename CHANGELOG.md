# Changelog

All notable changes to membo.ai will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Backend Services
  - Initial implementation of FSRS algorithm for spaced repetition
  - OpenAI integration for card generation
  - Voice processing pipeline for hands-free study
  
- Web Application
  - Content capture workflow
  - Study session interface
  - Analytics dashboard
  
- Mobile Apps
  - Cross-platform React Native implementation
  - Offline study capabilities
  - Voice interaction mode
  
- Chrome Extension
  - Web content capture
  - Quick capture popup
  - Context menu integration

### Changed
- Backend Services
  - Optimized card generation pipeline
  - Enhanced study scheduling algorithm
  
- Web Application
  - Improved card editor interface
  - Refined study session flow
  
- Mobile Apps
  - Updated navigation patterns
  - Enhanced offline sync
  
- Chrome Extension
  - Streamlined capture workflow

### Deprecated
- Backend Services
  - Legacy card generation endpoint (v0)
  
- Web Application
  - Basic study mode interface
  
- Mobile Apps
  - Beta sync implementation
  
- Chrome Extension
  - Old capture format

### Removed
- Backend Services
  - Deprecated beta API endpoints
  
- Web Application
  - Legacy study interface
  
- Mobile Apps
  - Unused beta features
  
- Chrome Extension
  - Obsolete settings

### Fixed
- Backend Services
  - Card generation timeout handling
  - Study session state management
  
- Web Application
  - Cross-browser compatibility issues
  - Performance optimizations
  
- Mobile Apps
  - iOS keyboard handling
  - Android notification issues
  
- Chrome Extension
  - Content capture reliability

### Security
- Backend Services
  - **SECURITY:** [GHSA-2023-001] Updated authentication flow
  - Enhanced rate limiting implementation
  
- Web Application
  - **SECURITY:** [GHSA-2023-002] Fixed XSS vulnerability
  - Improved input sanitization
  
- Mobile Apps
  - **SECURITY:** [GHSA-2023-003] Secure storage implementation
  - Enhanced biometric authentication
  
- Chrome Extension
  - **SECURITY:** [GHSA-2023-004] Content script isolation

## [1.0.0] - 2023-12-01

Initial release of membo.ai knowledge retention system.

### Components
- Backend: 1.0.0
- Web Application: 1.0.0
- Mobile Apps: 1.0.0 (iOS), 1.0.0 (Android)
- Chrome Extension: 1.0.0
- Infrastructure: 1.0.0

### Added
- Complete implementation of core knowledge retention system
- AI-powered card generation
- Spaced repetition study system
- Voice-enabled learning mode
- Cross-platform availability
- Chrome extension for content capture
- Real-time synchronization
- Analytics and progress tracking

### Security
- **SECURITY:** [GHSA-2023-001] Comprehensive security implementation
- End-to-end encryption for sensitive data
- OAuth 2.0 authentication flow
- Rate limiting and abuse prevention
- Secure data storage and transmission

For detailed migration guides and component compatibility matrices, see [docs/migrations/v1.0.0.md](docs/migrations/v1.0.0.md).

[Unreleased]: https://github.com/membo-ai/membo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/membo-ai/membo/releases/tag/v1.0.0