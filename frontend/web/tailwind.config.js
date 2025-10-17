/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      colors: {
        // Primary brand colors
        primary: {
          red: '#ef3824',
          'red-light': '#f56b5a',
          'red-dark': '#c72c1a',
          blue: '#1c3e93',
          'blue-light': '#4a68b3',
          'blue-dark': '#142d68',
        },
        // Secondary colors
        secondary: {
          gold: '#bdb52a',
          'gold-light': '#d4cc4a',
          'gold-dark': '#9a9220',
          gray: '#848689',
          'gray-light': '#a6a8ab',
          'gray-dark': '#5f6163',
        },
        // Extended neutral grays for contrast
        neutral: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#9aa0a6',
          500: '#5f6368',
          600: '#3c4043',
          700: '#202124',
          800: '#171717',
          900: '#0d0d0d',
        }
      },
    },
  },
  plugins: [],
}