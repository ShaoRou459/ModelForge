/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,css}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface1: 'var(--surface-1)',
        surface2: 'var(--surface-2)',
        text: 'var(--text)',
        textDim: 'var(--text-dim)',
        border: 'var(--border)',
        accent: 'var(--accent)'
      },
      borderRadius: {
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      boxShadow: {
        elev1: 'var(--elev-1)',
        elev2: 'var(--elev-2)'
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)'
      },
      transitionDuration: {
        quick: 'var(--dur-quick)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)'
      }
    },
  },
  plugins: [],
}


