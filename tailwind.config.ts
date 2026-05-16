import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial NYT-Games palette
        paper: 'hsl(var(--paper))',
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        empty: 'hsl(var(--empty))',
        hairline: 'hsl(var(--hairline))',
        accent: 'hsl(var(--accent))',
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',

        // shadcn mappings
        background: 'hsl(var(--paper))',
        foreground: 'hsl(var(--ink))',
        primary: {
          DEFAULT: 'hsl(var(--ink))',
          foreground: 'hsl(var(--paper))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--paper))',
        },
        card: {
          DEFAULT: 'hsl(var(--paper))',
          foreground: 'hsl(var(--ink))',
        },
        border: 'hsl(var(--hairline))',
        input: 'hsl(var(--hairline))',
        ring: 'hsl(var(--accent))',
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        sans: ['Helvetica', 'Arial', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      maxWidth: {
        frame: '26.25rem', // 420px — the contained play frame
      },
    },
  },
  plugins: [],
};

export default config;
