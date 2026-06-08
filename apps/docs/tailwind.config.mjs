/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: '#ea580c', foreground: '#ffffff' }, // Unified orange brand primary
        secondary: { DEFAULT: '#131316', foreground: '#e8e8ec' },
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
        muted: { DEFAULT: '#18181c', foreground: '#71717a' },
        accent: { DEFAULT: '#f59e0b', foreground: '#000000' },
        card: { DEFAULT: '#0d0d0f', foreground: '#e8e8ec' },
        popover: { DEFAULT: '#131316', foreground: '#e8e8ec' },
      },
      borderRadius: {
        none: '0px',
        xs: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      fontFamily: {
        sans: ['Play', 'sans-serif'],
        display: ['Play', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
