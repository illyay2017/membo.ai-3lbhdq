import { defineConfig } from 'cypress'; // ^13.0.0

export default defineConfig({
  e2e: {
    // Base configuration
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'src/web/tests/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,

    // Timeout configurations to validate API response times
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,

    // Media configurations
    video: false,
    screenshotOnRunFailure: true,

    // Test isolation and experimental features
    testIsolation: true,
    experimentalWebKitSupport: true,
    experimentalMemoryManagement: true,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalSessionAndOrigin: true,
    experimentalStudio: true,

    // Security settings
    chromeWebSecurity: false,

    // File watching configuration
    watchForFileChanges: true,

    // Retry configuration for stability
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Reporter configuration
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'spec, mocha-junit-reporter',
      mochaJunitReporterReporterOptions: {
        mochaFile: 'cypress/reports/junit/results-[hash].xml',
      },
    },

    // Environment variables
    env: {
      apiUrl: 'http://localhost:4000',
      coverage: true,
      codeCoverage: {
        exclude: [
          'src/web/tests/**/*',
          '**/*.test.{js,ts}',
          '**/*.spec.{js,ts}',
          '**/*.cy.{js,ts}',
          'cypress/**/*',
          'node_modules/**/*',
        ],
        include: [
          'src/web/components/**/*',
          'src/web/pages/**/*',
          'src/web/services/**/*',
        ],
        threshold: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
      db: {
        resetMethod: 'truncate',
        preserveTables: ['migrations', 'seeds'],
      },
      performance: {
        networkThrottling: {
          downloadSpeed: 1000000, // 1 Mbps
          uploadSpeed: 500000,    // 500 Kbps
          latency: 20,           // 20ms
        },
      },
    },

    setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
      // Register code coverage plugin
      require('@cypress/code-coverage/task')(on, config);

      // Configure test database reset hooks
      on('task', {
        async resetDb() {
          // Database reset logic would be implemented here
          return null;
        },
      });

      // Configure WebSocket testing support
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && browser.isHeadless) {
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--no-sandbox');
        }
        return launchOptions;
      });

      // Configure performance monitoring
      on('before:spec', (spec) => {
        // Performance monitoring setup would be implemented here
      });

      // Configure visual testing
      on('after:screenshot', (details) => {
        // Visual testing logic would be implemented here
        return details;
      });

      // Configure accessibility testing
      on('task', {
        async logA11y(violations) {
          // Accessibility logging logic would be implemented here
          return null;
        },
      });

      // Return the config
      return config;
    },
  },
});