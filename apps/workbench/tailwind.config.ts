// SPDX-License-Identifier: Apache-2.0

import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)', card: 'var(--card)', ink: 'var(--ink)',
        dim: 'var(--dim)', faint: 'var(--faint)',
        rust: 'var(--rust)', amber: 'var(--amber)', teal: 'var(--teal)',
        plum: 'var(--plum)', olive: 'var(--olive)', slate: 'var(--slate)',
        background: 'var(--paper)',
        foreground: 'var(--ink)',
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--rust)',
        muted: 'var(--paper2)',
        'muted-foreground': 'var(--dim)',
        accent: 'var(--paper2)',
        'accent-foreground': 'var(--ink)',
        primary: 'var(--rust)',
        'primary-foreground': 'var(--paper)',
        secondary: 'var(--paper2)',
        'secondary-foreground': 'var(--ink)',
        destructive: 'var(--rust)',
        popover: 'var(--card)',
        'popover-foreground': 'var(--ink)',
      },
      fontFamily: { sans: ['var(--sans)'], mono: ['var(--mono)'], serif: ['var(--serif)'] },
      fontSize: {
        'data-xs': ['10px', { lineHeight: '14px' }],
        'data-sm': ['11px', { lineHeight: '15px' }],
        'data-base': ['12px', { lineHeight: '16px' }],
        'data-lg': ['13px', { lineHeight: '18px' }],
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        'scale-in': {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-top': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateX(24px)' },
        },
        'cell-flash': {
          '0%': { boxShadow: '0 0 0 0 color-mix(in oklab, var(--rust) 50%, transparent)' },
          '60%': { boxShadow: '0 0 0 6px color-mix(in oklab, var(--rust) 18%, transparent)' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
        shake: {
          '10%, 90%': { transform: 'translateX(-1px)' },
          '20%, 80%': { transform: 'translateX(2px)' },
          '30%, 50%, 70%': { transform: 'translateX(-3px)' },
          '40%, 60%': { transform: 'translateX(3px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 color-mix(in oklab, var(--rust) 20%, transparent)' },
          '50%': { boxShadow: '0 0 8px 2px color-mix(in oklab, var(--rust) 12%, transparent)' },
        },
      },
      animation: {
        'scale-in': 'scale-in 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-in-top': 'slide-in-top 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-out': 'fade-out 200ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'cell-flash': 'cell-flash 700ms ease-out',
        shake: 'shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'fade-in': 'fade-in 150ms ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
