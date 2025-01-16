import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path';

export default defineConfig({
  // React plugin configuration with Fast Refresh and automatic JSX runtime
  plugins: [
    react({
      fastRefresh: true,
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
    }
  },

  // Preview server configuration for production builds
  preview: {
    port: 3000,
    strictPort: true,
    host: true
  }
});