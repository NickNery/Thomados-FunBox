import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        funbox: {
          background: '#101114',
          panel: '#191b20',
          accent: '#f59e0b',
          line: '#30343d'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
