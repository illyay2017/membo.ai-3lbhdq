import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path';

export default defineConfig({
  // React plugin configuration with Fast Refresh and automatic JSX runtime
  plugins: [
    react({
      jsxRuntime: 'automatic'
    })
  ],

  // Path resolution configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  // Build configuration with optimizations
  build: {
    // Target modern browsers with ES2022 support
    target: 'es2022',
    
    // Output directory configuration
    outDir: 'dist',
    assetsDir: 'assets',
    
    // Enable sourcemaps for debugging
    sourcemap: true,
    
    // Use esbuild for faster minification
    minify: 'esbuild',
    cssMinify: true,
    
    // Rollup-specific options for chunk optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core vendor dependencies
          vendor: [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          // UI component libraries
          ui: [
            '@radix-ui/react-*',
            'lucide-react'
          ]
        }
      }
    }
  },

  // Development server configuration
  server: {
    // Use port 3000 for development
    port: 3000,
    // Ensure strict port usage
    strictPort: true,
    // Enable access from other devices on network
    host: true,
    // Enable CORS for API integration
    cors: true,
    // Hot Module Replacement configuration
    hmr: {
      // Show error overlay during development
      overlay: true
    },
    headers: {
      // Security headers
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com https://api.membo.ai https://storage.googleapis.com"
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()'
    }
  },

  // Preview server configuration for production builds
  preview: {
    port: 3000,
    strictPort: true,
    host: true
  }
});
