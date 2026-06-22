/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FBCE07',
          'yellow-dk': '#D4AE00',
        },
        sidebar: '#13162B',
      },
      fontFamily: {
        sans: [
          '"Segoe UI"', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 24px 48px rgba(0,0,0,0.14), 0 6px 16px rgba(0,0,0,0.08)',
        'btn-yellow': '0 6px 18px rgba(251,206,7,0.32)',
        'btn-green': '0 6px 18px rgba(16,185,129,0.28)',
      },
    },
  },
  plugins: [],
}
