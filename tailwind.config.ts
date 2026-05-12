import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'hsl(var(--paper))',
        'paper-shadow': 'hsl(var(--paper-shadow))',
        ink: 'hsl(var(--ink))',
        'ink-soft': 'hsl(var(--ink-soft))',
        'rule-blue': 'hsl(var(--rule-blue))',
        'margin-red': 'hsl(var(--margin-red))',
        'tile-wood': 'hsl(var(--tile-wood))',
        'tile-wood-edge': 'hsl(var(--tile-wood-edge))',
        'tile-ink': 'hsl(var(--tile-ink))',
        'accent-green': 'hsl(var(--accent-green))',
        'accent-red': 'hsl(var(--accent-red))',
        'accent-gold': 'hsl(var(--accent-gold))',
        // shadcn mappings
        background: 'hsl(var(--paper))',
        foreground: 'hsl(var(--ink))',
        primary: {
          DEFAULT: 'hsl(var(--accent-green))',
          foreground: 'hsl(var(--paper))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--accent-red))',
          foreground: 'hsl(var(--paper))',
        },
        muted: {
          DEFAULT: 'hsl(var(--paper-shadow))',
          foreground: 'hsl(var(--ink-soft))',
        },
        card: {
          DEFAULT: 'hsl(var(--paper-shadow))',
          foreground: 'hsl(var(--ink))',
        },
        border: 'hsl(var(--ink) / 0.18)',
        input: 'hsl(var(--ink) / 0.18)',
        ring: 'hsl(var(--ink) / 0.5)',
      },
      fontFamily: {
        display: ['"Special Elite"', 'monospace'],
        hand: ['Caveat', 'cursive'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        tile: ['"Roboto Slab"', 'serif'],
      },
      keyframes: {
        'tile-drop': {
          '0%': { transform: 'translateY(-20px) rotate(0deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) var(--final-rotate, rotate(0deg))', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' },
        },
      },
      animation: {
        'tile-drop': 'tile-drop 400ms ease-out both',
        shake: 'shake 200ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
