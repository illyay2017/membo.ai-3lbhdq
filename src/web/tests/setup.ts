import { setupServer } from 'msw/node'; // v1.3.0
import '@testing-library/jest-dom'; // v5.16.5
import { TextEncoder } from 'util'; // v0.12.0
import { handlers } from './mocks/handlers';

// Constants for test configuration
const TEST_TIMEOUT = 10000; // 10 seconds global test timeout
const API_MOCK_DELAY = 100; // Simulated API delay in ms
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Configure retry options for flaky tests
const RETRY_OPTIONS = {
  retries: 3,
  backoff: 'exponential'
} as const;

/**
 * Initialize and configure MSW server with comprehensive error handling and logging
 * @returns Configured MSW server instance
 */
const setupMockServer = () => {
  // Create MSW server instance with imported handlers
  const server = setupServer(...handlers);

  // Configure request logging for debugging
  if (DEBUG_MODE) {
    server.events.on('request:start', ({ request }) => {
      console.log(`[MSW] ${request.method} ${request.url}`);
    });

    server.events.on('request:match', ({ request, requestId }) => {
      console.log(`[MSW] Request matched: ${requestId}`);
    });

    server.events.on('request:unhandled', ({ request }) => {
      console.warn(`[MSW] Unhandled request: ${request.method} ${request.url}`);
    });
  }

  // Configure response delay to simulate realistic API behavior
  server.events.on('response:mocked', async ({ response }) => {
    await new Promise(resolve => setTimeout(resolve, API_MOCK_DELAY));
    return response;
  });

  return server;
};

/**
 * Configure global test environment settings
 */
const configureTestEnvironment = () => {
  // Set global test timeout
  jest.setTimeout(TEST_TIMEOUT);

  // Configure TextEncoder for Node environment
  if (!global.TextEncoder) {
    global.TextEncoder = TextEncoder;
  }

  // Configure console error handling
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Configure test environment variables
  process.env.API_URL = 'http://localhost:4000';
  process.env.ENABLE_MSW = 'true';
};

// Initialize MSW server
export const server = setupMockServer();

// Configure global test setup
beforeAll(async () => {
  configureTestEnvironment();
  server.listen({ onUnhandledRequest: 'warn' });
});

// Cleanup after each test
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Global test teardown
afterAll(async () => {
  server.close();
  jest.clearAllTimers();
});