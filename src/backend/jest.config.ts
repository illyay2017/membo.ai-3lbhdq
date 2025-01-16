import type { Config } from '@jest/types';

const jestConfig: Config.InitialOptions = {
  // TypeScript and environment configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // Module resolution and file extensions
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1'
  },
  
  // Test pattern matching
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  
  // TypeScript transformation
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  
  // Coverage configuration
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/types/**',
    '!src/interfaces/**',
    '!src/db/migrations/**',
    '!src/db/seeds/**',
    '!src/config/**',
    '!src/**/*.d.ts'
  ],
  
  // Test setup and environment
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.git/'
  ],
  
  // Test execution configuration
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};

export default jestConfig;