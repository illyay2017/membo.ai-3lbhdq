/**
 * PostCSS configuration for membo.ai web application
 * Configures CSS processing pipeline with Tailwind CSS and optimization plugins
 * @version 1.0.0
 */

module.exports = {
  plugins: [
    // Enable @import resolution and CSS modules
    require('postcss-import')(), // v15.x

    // Process Tailwind CSS directives and utilities
    require('tailwindcss')({ // v3.x
      config: './tailwind.config.ts'
    }),

    // Add vendor prefixes for browser compatibility
    require('autoprefixer')({ // v10.x
      flexbox: 'no-2009', // Modern flexbox implementation
      grid: 'autoplace' // Enable grid autoplace features
    })
  ]
};