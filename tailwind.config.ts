import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['GeistVariable', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          base: '#0f0e0d',
          raised: '#1a1917',
          overlay: '#242220',
          border: '#2e2c29',
          'border-subtle': '#201f1d',
        },
        ink: {
          primary: '#f0ede8',
          secondary: '#9e9a94',
          tertiary: '#5c5955',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
