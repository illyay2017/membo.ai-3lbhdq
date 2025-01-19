import type { Config } from 'tailwindcss'
import { colors } from './src/constants/theme'

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...colors,
        card: {
          background: 'hsl(var(--card-background))',
          foreground: 'hsl(var(--card-foreground))'
        },
        border: 'hsl(var(--border))',
        input: {
          background: 'hsl(var(--input-background))',
          foreground: 'hsl(var(--input-foreground))'
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          foreground: 'hsl(var(--text))'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
} satisfies Config
