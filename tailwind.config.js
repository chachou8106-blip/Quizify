/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        grape: { DEFAULT: '#7C3AED', dark: '#5B21B6', light: '#A78BFA' },
        bubble: { DEFAULT: '#EC4899', light: '#F9A8D4' },
        sunny: { DEFAULT: '#FBBF24', light: '#FDE68A' },
        minty: { DEFAULT: '#10B981', light: '#6EE7B7' },
        sky2: { DEFAULT: '#06B6D4', light: '#67E8F9' },
        cherry: { DEFAULT: '#EF4444' },
        cream: '#FFF9F0',
      },
      fontFamily: {
        display: ['Baloo 2', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pop: '0 6px 0 rgba(0,0,0,0.12)',
        card: '0 10px 30px rgba(124,58,237,0.12)',
      },
      keyframes: {
        wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pulseBig: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
      },
      animation: {
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        floaty: 'floaty 3s ease-in-out infinite',
        pulseBig: 'pulseBig 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
