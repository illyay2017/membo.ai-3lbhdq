/**
 * PostCSS configuration for membo.ai web application
 * Configures CSS processing pipeline with Tailwind CSS and optimization plugins
 * @version 1.0.0
 */

export default {
  plugins: {
    'postcss-import': {},
    'tailwindcss': { config: './tailwind.config.ts' },
    'autoprefixer': {}
  }
};
