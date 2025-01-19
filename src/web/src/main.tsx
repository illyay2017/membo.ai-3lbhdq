import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App';

// Import global styles in correct cascade order
import './styles/tailwind.css';
import './styles/globals.css';

/**
 * Main function that initializes and renders the React application
 * with error handling and cleanup
 */
function main() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <AppWrapper />
    </StrictMode>
  );
}

/**
 * Development error handler for logging and monitoring
 */
function handleError(error: Error | unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error('Application initialization error:', error);
  }
  // In production, errors will be caught by error boundaries
  // and reported to monitoring service
}

// Initialize application
main();
