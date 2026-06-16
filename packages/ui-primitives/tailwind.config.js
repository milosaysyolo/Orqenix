// SPDX-License-Identifier: Apache-2.0
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        orqenix: {
          emerald: {
            50: 'oklch(0.96 0.04 154)',
            100: 'oklch(0.91 0.08 154)',
            200: 'oklch(0.83 0.14 154)',
            300: 'oklch(0.74 0.18 154)',
            400: 'oklch(0.65 0.20 154)',
            500: 'oklch(0.56 0.20 154)',
            600: 'oklch(0.48 0.18 154)',
            700: 'oklch(0.40 0.16 154)',
            800: 'oklch(0.32 0.13 154)',
            900: 'oklch(0.24 0.10 154)',
            950: 'oklch(0.16 0.06 154)',
          },
          violet: {
            50: 'oklch(0.96 0.03 270)',
            100: 'oklch(0.91 0.06 270)',
            200: 'oklch(0.83 0.12 270)',
            300: 'oklch(0.74 0.17 270)',
            400: 'oklch(0.64 0.21 270)',
            500: 'oklch(0.55 0.22 270)',
            600: 'oklch(0.47 0.21 270)',
            700: 'oklch(0.39 0.18 270)',
            800: 'oklch(0.31 0.15 270)',
            900: 'oklch(0.23 0.11 270)',
            950: 'oklch(0.16 0.07 270)',
          },
          amber: {
            50: 'oklch(0.97 0.03 80)',
            100: 'oklch(0.93 0.07 80)',
            200: 'oklch(0.87 0.14 80)',
            300: 'oklch(0.81 0.17 80)',
            400: 'oklch(0.75 0.18 80)',
            500: 'oklch(0.69 0.18 80)',
            600: 'oklch(0.59 0.17 80)',
            700: 'oklch(0.49 0.15 80)',
            800: 'oklch(0.40 0.13 80)',
            900: 'oklch(0.31 0.10 80)',
            950: 'oklch(0.22 0.07 80)',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
