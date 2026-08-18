import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          page: 'rgb(var(--surface-page) / <alpha-value>)',
          sidebar: 'rgb(var(--surface-sidebar) / <alpha-value>)',
          panel: 'rgb(var(--surface-panel) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
          'border-subtle': 'rgb(var(--surface-border-subtle) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
        },
        accent: {
          primary: 'rgb(var(--accent-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--accent-primary-hover) / <alpha-value>)',
          warning: '#eed49f',
        },
        red: {
          200: '#ed8796',
          300: '#ed8796',
          400: '#ee99a0',
          900: '#ed8796',
          950: '#ed8796',
        },
        amber: {
          100: '#eed49f',
          200: '#eed49f',
          300: '#eed49f',
          700: '#eed49f',
          900: '#eed49f',
          950: '#eed49f',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
