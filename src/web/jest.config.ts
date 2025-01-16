import type { Config } from '@jest/types';

// Create and export the Jest configuration
const jestConfig: Config.InitialOptions = {
  // Use jsdom environment for browser-like testing
  testEnvironment: 'jsdom',

  // Test setup file to run after Jest is loaded
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // File extensions Jest will look for
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Module name mapping for path aliases and static assets
  moduleNameMapper: {
    // Map @ alias to src directory
    '^@/(.*)$': '<rootDir>/src/$1',
    // Handle static assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Transform TypeScript and JavaScript files using SWC
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.(ts|tsx)',
    '<rootDir>/src/**/*.test.(ts|tsx)',
  ],

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Watch plugins for better test filtering
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Global variables available in all test files
  globals: {
    TEST_ENVIRONMENT: 'jsdom',
  },

  // Ignore patterns for test running
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Clear mocks between each test
  clearMocks: true,

  // Verbose output for test results
  verbose: true,

  // Automatically restore mocks between every test
  restoreMocks: true,

  // Detect open handles (async operations that weren't cleaned up)
  detectOpenHandles: true,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Error handling
  bail: 1,
  errorOnDeprecated: true,
};

export default jestConfig;