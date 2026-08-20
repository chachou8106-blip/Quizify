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
        // Trois trajectoires de balade différentes, pour que les emojis ne
        // bougent pas tous pareil.
        driftA: {
          '0%,100%': { transform: 'translate(0,0) rotate(0deg)' },
          '25%': { transform: 'translate(18px,-22px) rotate(8deg)' },
          '50%': { transform: 'translate(-12px,-38px) rotate(-6deg)' },
          '75%': { transform: 'translate(-22px,-14px) rotate(5deg)' },
        },
        driftB: {
          '0%,100%': { transform: 'translate(0,0) rotate(0deg)' },
          '33%': { transform: 'translate(-26px,-18px) rotate(-10deg)' },
          '66%': { transform: 'translate(20px,-34px) rotate(9deg)' },
        },
        driftC: {
          '0%,100%': { transform: 'translate(0,0) rotate(-4deg)' },
          '20%': { transform: 'translate(14px,-16px) rotate(6deg)' },
          '55%': { transform: 'translate(28px,-30px) rotate(-8deg)' },
          '80%': { transform: 'translate(-16px,-20px) rotate(4deg)' },
        },
        pulseBig: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
      },
      animation: {
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        floaty: 'floaty 3s ease-in-out infinite',
        driftA: 'driftA 14s ease-in-out infinite',
        driftB: 'driftB 18s ease-in-out infinite',
        driftC: 'driftC 22s ease-in-out infinite',
        pulseBig: 'pulseBig 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
