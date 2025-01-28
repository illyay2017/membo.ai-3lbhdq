import type { Config } from 'tailwindcss'
import { colors, typography } from './src/constants/theme'
import tailwindForms from '@tailwindcss/forms'
import tailwindAnimate from 'tailwindcss-animate'

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  darkMode: ['class', 'class'],
  theme: {
  	extend: {
  		opacity: {
  			'50': '0.5'
  		},
  		ringColor: {
  			primary: 'var(--color-primary)'
  		},
  		colors: {
  			background: {
  				DEFAULT: 'hsl(var(--background))',
  				input: 'var(--color-input-background)'
  			},
  			primary: {
  				'10': 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
  				'50': 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-dark': 'var(--color-primary-dark)',
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			'secondary-dark': 'var(--color-secondary-dark)',
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			'accent-dark': 'var(--color-accent-dark)',
  			error: 'var(--color-error)',
  			'error-dark': 'var(--color-error-dark)',
  			border: 'hsl(var(--border))',
  			ring: 'hsl(var(--ring))',
  			foreground: 'hsl(var(--foreground))',
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  			mono: ['JetBrains Mono', 'monospace'],
  			primary: [
  				'typography.fontFamily.primary',
  				'system-ui',
  				'sans-serif'
  			],
  			secondary: [
  				'typography.fontFamily.secondary',
  				'system-ui',
  				'sans-serif'
  			],
  			code: [
  				'typography.fontFamily.code',
  				'monospace'
  			]
  		},
  		fontSize: {
  			...typography.fontSize
  		},
  		spacing: {
  			'1': '4px',
  			'2': '8px',
  			'3': '12px',
  			'4': '16px',
  			'6': '24px',
  			'8': '32px',
  			'12': '48px',
  			'16': '64px'
  		},
  		screens: {
  			mobile: '320px',
  			tablet: '768px',
  			desktop: '1024px',
  			wide: '1280px'
  		},
  		container: {
  			center: true,
  			padding: {
  				DEFAULT: '1rem',
  				sm: '2rem',
  				lg: '4rem',
  				xl: '5rem'
  			},
  			maxWidth: {
  				DEFAULT: '1280px'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		ringOpacity: {
  			'10': '0.1',
  			'50': '0.5'
  		}
  	}
  },
  plugins: [
    tailwindForms,
    tailwindAnimate
  ],
} satisfies Config
