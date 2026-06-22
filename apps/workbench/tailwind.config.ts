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
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
    },
  },
  plugins: [],
} satisfies Config;
