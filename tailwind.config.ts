import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        funbox: {
          background: '#2C2F33',
          panel: '#2C2F33',
          secondary: '#4A5466',
          accent: '#4371CC',
          line: '#4A5466'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
