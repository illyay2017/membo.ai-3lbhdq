# membo.ai Android Fastlane Documentation

## Installation

Make sure you have the latest version of Fastlane installed (2.212.2):

```bash
# Using RubyGems
gem install fastlane -v 2.212.2

# Alternatively using Bundler
bundle add fastlane -v 2.212.2
```

## Environment Setup

The following environment variables must be configured:

- `GOOGLE_PLAY_JSON_KEY` - Google Play Console service account credentials
- `SLACK_WEBHOOK_URL` - Webhook URL for Slack notifications
- `FIREBASE_APP_ID` - Firebase project identifier
- `KEYSTORE_PATH` - Path to Android keystore file
- `KEYSTORE_PASSWORD` - Android keystore password
- `KEY_ALIAS` - Android key alias
- `KEY_PASSWORD` - Android key password
- `CODECOV_TOKEN` - Codecov upload token

## Available Lanes

### test

Runs comprehensive test suite with enhanced coverage reporting.

```bash
fastlane android test
```

Actions:
- Cleans build environment
- Executes unit tests in parallel
- Runs instrumentation tests
- Generates JaCoCo coverage report
- Uploads coverage to Codecov

### beta

Deploys a new beta version to the Play Store internal testing track.

```bash
fastlane android beta
```

Actions:
- Verifies build environment
- Increments version code
- Generates changelog
- Captures screenshots
- Builds release bundle
- Uploads to Play Store beta track (50% rollout)
- Uploads mapping file to Firebase Crashlytics

### deploy

Deploys a new production release to the Play Store.

```bash
fastlane android deploy
```

Actions:
- Verifies production readiness
- Ensures deployment from main branch
- Verifies changelog and screenshots
- Builds release bundle
- Runs security scan
- Uploads to Play Store production track (10% rollout)
- Tags release
- Uploads release artifacts

## Error Handling

The pipeline includes comprehensive error handling:
- Automatic error reporting to Slack
- Crash report upload to Firebase
- Build artifact cleanup
- Detailed error logs with stack traces

## Monitoring & Metrics

Each lane execution is monitored with:
- Build performance metrics
- Test coverage reporting
- Deployment success rates
- Rollout monitoring

## App Configuration

The Android app is configured with:
- Package Name: ai.membo
- Google Play credentials: ../app/google-services.json
- Version management via build.gradle
- Automated version code incrementation

## Best Practices

1. Always run tests before deployment:
```bash
fastlane android test
```

2. Use beta lane for internal testing:
```bash
fastlane android beta
```

3. Production deployments require main branch:
```bash
git checkout main
fastlane android deploy
```

## Additional Resources

- [Fastlane Documentation](https://docs.fastlane.tools)
- [Google Play Console](https://play.google.com/console)
- [Firebase Console](https://console.firebase.google.com)