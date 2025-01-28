import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import global styles in correct cascade order
import './styles/globals.css';

/**
 * Main function that initializes and renders the React application
 * with error handling and cleanup
 */
function main() {
  // Get root element with type safety
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }

  // Create React root using React 18 createRoot API
  const root = ReactDOM.createRoot(rootElement);

  try {
    // Render app with StrictMode for development best practices
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    // Setup development error logging
    if (process.env.NODE_ENV === 'development') {
      window.onerror = (message, source, line, column, error) => {
        console.error('Global error:', {
          message,
          source,
          line,
          column,
          error
        });
      };

      window.onunhandledrejection = (event) => {
        console.error('Unhandled promise rejection:', event.reason);
      };
    }

    // Cleanup on unmount
    return () => {
      root.unmount();
    };
  } catch (error) {
    handleError(error);
    throw error; // Re-throw for error boundary capture
  }
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
