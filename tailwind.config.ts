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
          base: '#24273a',
          raised: '#1e2030',
          overlay: '#363a4f',
          border: '#494d64',
          'border-subtle': '#363a4f',
        },
        ink: {
          primary: '#cad3f5',
          secondary: '#b8c0e0',
          tertiary: '#8087a2',
        },
        accent: {
          primary: '#c6a0f6',
          secondary: '#8bd5ca',
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
