# fastlane documentation

## Installation

Make sure you have the latest version of the Xcode command line tools installed:

```bash
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing fastlane](https://docs.fastlane.tools/#installing-fastlane)

## Available Actions

### iOS Lanes

#### setup

```bash
fastlane ios setup
```

Sets up the development environment by:
- Installing required certificates
- Installing provisioning profiles
- Setting up match for certificate management
- Configuring environment variables

#### test

```bash
fastlane ios test
```

Runs all iOS tests including:
- Unit tests
- Integration tests 
- UI tests

Generates test coverage reports and uploads results to CI

#### build

```bash
fastlane ios build
```

Builds the iOS app:
- Increments build number
- Installs dependencies via CocoaPods
- Builds app for development
- Signs with development certificate

#### beta

```bash
fastlane ios beta
```

Deploys a beta build to TestFlight:
- Increments version numbers
- Runs tests
- Builds app for TestFlight
- Uploads to App Store Connect
- Notifies beta testers

#### release

```bash
fastlane ios release
```

Deploys a production release to the App Store:
- Increments version numbers
- Runs full test suite
- Builds production IPA
- Uploads to App Store
- Submits for review

## Environment Setup

The following environment variables need to be configured:

```
MATCH_PASSWORD="xxx" # Password for decrypting match certificates
FASTLANE_USER="xxx" # Apple ID email
FASTLANE_PASSWORD="xxx" # App-specific password for Apple ID
MATCH_GIT_URL="xxx" # Git repo URL for match certificate storage
APP_STORE_CONNECT_API_KEY="xxx" # App Store Connect API key
```

## Certificate Management

We use _match_ for handling certificates and provisioning profiles. The certificates are stored in a private Git repository.

To sync certificates:

```bash
fastlane match development
fastlane match appstore
```

To create new certificates:

```bash
fastlane match nuke development
fastlane match development
```

## Deployment Process

### Beta Deployment

1. Ensure all tests are passing locally
2. Update changelog in metadata folder
3. Run: `fastlane ios beta`
4. Monitor build progress in App Store Connect
5. Verify TestFlight build

### App Store Release

1. Update app metadata and screenshots
2. Update version number in project
3. Run: `fastlane ios release`
4. Submit compliance information
5. Monitor review process

## More Information

- App Bundle ID: ai.membo.app
- Fastlane Version: 2.217.0
- Xcode Version: 15.0+
- Ruby Version: 3.0.0+

For detailed documentation on individual lanes and configurations, see:
- Appfile: App-specific configuration
- Fastfile: Available lanes and actions
- Matchfile: Certificate management settings

For additional help, visit:
- [fastlane docs](https://docs.fastlane.tools)
- [fastlane GitHub](https://github.com/fastlane/fastlane)