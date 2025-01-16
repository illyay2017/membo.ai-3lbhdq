# membo.ai iOS Application

Comprehensive guide for setting up, developing, and deploying the membo.ai iOS application.

## Prerequisites

- Xcode 14.0+ with iOS 13.0+ SDK
- CocoaPods 1.14.0+ (`sudo gem install cocoapods`)
- Node.js 20.x LTS
- Ruby 3.0+ with Bundler (`gem install bundler`)
- React Native CLI (`npm install -g react-native-cli`)
- Apple Developer Account with team access
- Firebase project setup
- Code signing certificates and provisioning profiles

## Environment Setup

### 1. Required Environment Variables

```bash
# Apple Developer Account
export APPLE_ID="your.email@example.com"
export APPLE_TEAM_ID="XXXXXXXXXX"
export APP_STORE_CONNECT_TEAM_ID="XXXXXXXXXX"

# Fastlane Match
export MATCH_PASSWORD="your-match-password"
export MATCH_GIT_URL="git@github.com:your-org/certificates.git"

# Build Configuration
export WORKSPACE="membo"
export SCHEME="membo"

# Monitoring
export SENTRY_DSN="https://your-sentry-dsn"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"
```

### 2. Firebase Setup

1. Place `GoogleService-Info.plist` in the project root
2. Verify bundle identifier matches: `ai.membo.app`
3. Enable required Firebase services:
   - Analytics
   - Authentication
   - Cloud Storage
   - Cloud Messaging

### 3. Code Signing Setup

```bash
# Install certificates and provisioning profiles
fastlane ios setup
```

## Installation

1. Install JavaScript dependencies:
```bash
npm install
```

2. Install CocoaPods dependencies:
```bash
cd ios
pod install
```

3. Verify development environment:
```bash
fastlane ios setup
```

## Development

### Local Development

1. Start Metro bundler:
```bash
npm start
```

2. Run iOS simulator:
```bash
npm run ios
```

### Testing

```bash
# Run unit tests
fastlane ios test

# Run E2E tests
npm run e2e:ios
```

### Debugging

- React Native Debugger: `open "rndebugger://set-debugger-loc?host=localhost&port=8081"`
- Xcode Console: Window > Devices and Simulators
- Network Inspector: Debug menu > Open Debugger > Network

## Deployment

### TestFlight Beta

```bash
# Deploy to TestFlight
fastlane ios beta
```

Requirements:
- Valid certificates and provisioning profiles
- Passing test suite
- Updated changelog
- Version bump
- Clean git status

### App Store Release

```bash
# Deploy to App Store
fastlane ios release
```

Requirements:
- All TestFlight requirements
- App Store screenshots
- Marketing materials
- Privacy policy updates
- Support documentation
- App review guidelines compliance

## Architecture

### Native Modules

- Voice Recognition (React-Native-Voice v3.2.4)
- Firebase SDK (v10.18.0)
- Push Notifications
- Background Audio
- Keychain Access

### Build Configurations

- Debug: Development environment
- Staging: TestFlight testing
- Release: App Store distribution

### Security Features

- SSL Pinning
- Keychain data encryption
- Biometric authentication support
- Secure storage for sensitive data
- Certificate pinning for API endpoints

## Performance Optimization

- Hermes JavaScript engine enabled
- Static linking of frameworks
- Asset catalogs optimization
- Network request caching
- Memory usage monitoring

## Troubleshooting

### Common Issues

1. Pod installation fails:
```bash
pod cache clean --all
pod deintegrate
pod setup
pod install
```

2. Code signing issues:
```bash
fastlane ios setup
```

3. Build errors:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
xcodebuild clean
pod install
```

### Support Resources

- [React Native Documentation](https://reactnative.dev/docs/environment-setup)
- [Apple Developer Portal](https://developer.apple.com)
- [Firebase Console](https://console.firebase.google.com)
- [Fastlane Documentation](https://docs.fastlane.tools)

## Monitoring & Analytics

- Firebase Analytics for user behavior
- Sentry for error tracking
- Custom performance monitoring
- Network request logging
- Crash reporting

## Security Guidelines

- Regular security audits
- Dependency vulnerability scanning
- Runtime integrity checks
- Secure storage best practices
- API request signing

## Version Control

- Feature branch workflow
- Pull request reviews required
- CI/CD pipeline integration
- Version tagging for releases
- Changelog maintenance

## Support

For technical support:
- Slack: #ios-development
- Email: ios-support@membo.ai
- JIRA: iOS project board

## License

Copyright © 2023 membo.ai. All rights reserved.