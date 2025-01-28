import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      '@': path.resolve(__dirname, './src'),
      '@fontsource': path.resolve(__dirname, 'node_modules/@fontsource')
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
    // Use port 5173 for development
    port: 5173,
    // Ensure strict port usage
    strictPort: true,
    // Enable access from other devices on network
    host: true,
    // Enable CORS for API integration
    cors: true,
    // Hot Module Replacement configuration
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173
    },
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 300,
      ignored: ['**/node_modules/**', '**/dist/**']
    },
    headers: {
      // Security headers that were previously in meta tags
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' ws: wss: http://0.0.0.0:* http://localhost:* https://api.membo.ai https://storage.googleapis.com",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
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
    host: true,
    headers: {
      // Same security headers for preview server
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' ws: wss: http://0.0.0.0:* http://localhost:* https://api.membo.ai https://storage.googleapis.com",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()'
    }
  },

  css: {
    preprocessorOptions: {
      css: {
        includePaths: ['node_modules']
      }
    }
  },

  define: {
    // Add this section to handle process.env
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      VITE_API_URL: JSON.stringify(process.env.VITE_API_URL),
      // Add any other env variables you need
    }
  }
});
