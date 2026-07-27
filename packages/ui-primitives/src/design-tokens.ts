// SPDX-License-Identifier: Apache-2.0
// @orqenix/ui-primitives, Design tokens
//
// OKLCH-based color palette per CR v8.0 G61-09.
//
// OKLCH advantages over HSL:
//   - Perceptually uniform: equal numeric changes feel equal to the eye
//   - Wider gamut: supports modern P3 displays
//   - Better gradients: no muddy transitions through gray
//   - Future-proof: aligned with CSS Color Module Level 4
//
// Fallback: Browsers without OKLCH support (pre-Chrome 111 / Safari 16.4)
// fall back to HSL via @supports query in styles.css.

// ─────────────────────────────────────────────────────────────────────────
// Color scale type
// ─────────────────────────────────────────────────────────────────────────

export interface ColorScale {
  /** Lightest tint, usually background tints */
  "50": string;
  "100": string;
  "200": string;
  "300": string;
  /** Default mid-tone */
  "400": string;
  "500": string;
  "600": string;
  "700": string;
  "800": string;
  "900": string;
  /** Deepest shade */
  "950": string;
}

// ─────────────────────────────────────────────────────────────────────────
// Brand colors, Orqenix identity
// ─────────────────────────────────────────────────────────────────────────

export interface BrandColors {
  /** Primary brand color, growth, knowledge, life */
  emerald: ColorScale;
  /** Secondary brand color, intelligence, depth */
  violet: ColorScale;
  /** Accent color, attention, warning, energy */
  amber: ColorScale;
}

export const brandColors: BrandColors = {
  emerald: {
    "50": "oklch(0.96 0.04 154)",
    "100": "oklch(0.91 0.08 154)",
    "200": "oklch(0.83 0.14 154)",
    "300": "oklch(0.74 0.18 154)",
    "400": "oklch(0.65 0.20 154)",
    "500": "oklch(0.56 0.20 154)", // Default emerald
    "600": "oklch(0.48 0.18 154)",
    "700": "oklch(0.40 0.16 154)",
    "800": "oklch(0.32 0.13 154)",
    "900": "oklch(0.24 0.10 154)",
    "950": "oklch(0.16 0.06 154)",
  },
  violet: {
    "50": "oklch(0.96 0.03 270)",
    "100": "oklch(0.91 0.06 270)",
    "200": "oklch(0.83 0.12 270)",
    "300": "oklch(0.74 0.17 270)",
    "400": "oklch(0.64 0.21 270)",
    "500": "oklch(0.55 0.22 270)", // Default violet
    "600": "oklch(0.47 0.21 270)",
    "700": "oklch(0.39 0.18 270)",
    "800": "oklch(0.31 0.15 270)",
    "900": "oklch(0.23 0.11 270)",
    "950": "oklch(0.16 0.07 270)",
  },
  amber: {
    "50": "oklch(0.97 0.03 80)",
    "100": "oklch(0.93 0.07 80)",
    "200": "oklch(0.87 0.14 80)",
    "300": "oklch(0.81 0.17 80)",
    "400": "oklch(0.75 0.18 80)",
    "500": "oklch(0.69 0.18 80)", // Default amber
    "600": "oklch(0.59 0.17 80)",
    "700": "oklch(0.49 0.15 80)",
    "800": "oklch(0.40 0.13 80)",
    "900": "oklch(0.31 0.10 80)",
    "950": "oklch(0.22 0.07 80)",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Semantic colors, map roles (background, foreground, etc.)
// ─────────────────────────────────────────────────────────────────────────

export interface SemanticColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

export const semanticLight: SemanticColors = {
  background: "oklch(1.00 0 0)",
  foreground: "oklch(0.15 0.01 270)",
  card: "oklch(1.00 0 0)",
  cardForeground: "oklch(0.15 0.01 270)",
  popover: "oklch(1.00 0 0)",
  popoverForeground: "oklch(0.15 0.01 270)",
  primary: "oklch(0.20 0.01 270)",
  primaryForeground: "oklch(0.98 0 0)",
  secondary: "oklch(0.96 0.01 270)",
  secondaryForeground: "oklch(0.20 0.01 270)",
  muted: "oklch(0.96 0.01 270)",
  mutedForeground: "oklch(0.55 0.01 270)",
  accent: "oklch(0.96 0.01 270)",
  accentForeground: "oklch(0.20 0.01 270)",
  destructive: "oklch(0.62 0.24 25)",
  destructiveForeground: "oklch(0.98 0 0)",
  border: "oklch(0.92 0.01 270)",
  input: "oklch(0.92 0.01 270)",
  ring: "oklch(0.20 0.01 270)",
};

export const semanticDark: SemanticColors = {
  background: "oklch(0.13 0.01 270)",
  foreground: "oklch(0.98 0 0)",
  card: "oklch(0.13 0.01 270)",
  cardForeground: "oklch(0.98 0 0)",
  popover: "oklch(0.13 0.01 270)",
  popoverForeground: "oklch(0.98 0 0)",
  primary: "oklch(0.98 0 0)",
  primaryForeground: "oklch(0.20 0.01 270)",
  secondary: "oklch(0.22 0.01 270)",
  secondaryForeground: "oklch(0.98 0 0)",
  muted: "oklch(0.22 0.01 270)",
  mutedForeground: "oklch(0.65 0.01 270)",
  accent: "oklch(0.22 0.01 270)",
  accentForeground: "oklch(0.98 0 0)",
  destructive: "oklch(0.41 0.21 25)",
  destructiveForeground: "oklch(0.98 0 0)",
  border: "oklch(0.22 0.01 270)",
  input: "oklch(0.22 0.01 270)",
  ring: "oklch(0.85 0.01 270)",
};

// ─────────────────────────────────────────────────────────────────────────
// Typography scale
// ─────────────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Spacing scale (rem-based, matches Tailwind defaults)
// ─────────────────────────────────────────────────────────────────────────

export const spacing = {
  "0": "0",
  "0.5": "0.125rem", // 2px
  "1": "0.25rem", // 4px
  "1.5": "0.375rem", // 6px
  "2": "0.5rem", // 8px
  "2.5": "0.625rem", // 10px
  "3": "0.75rem", // 12px
  "4": "1rem", // 16px
  "5": "1.25rem", // 20px
  "6": "1.5rem", // 24px
  "8": "2rem", // 32px
  "10": "2.5rem", // 40px
  "12": "3rem", // 48px
  "16": "4rem", // 64px
  "20": "5rem", // 80px
  "24": "6rem", // 96px
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Border radius scale
// ─────────────────────────────────────────────────────────────────────────

export const radii = {
  none: "0",
  sm: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  full: "9999px",
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Z-index scale (semantic layers)
// ─────────────────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  banner: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  commandPalette: 90,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Aggregate tokens export
// ─────────────────────────────────────────────────────────────────────────

export interface Tokens {
  colors: {
    orqenix: BrandColors;
    light: SemanticColors;
    dark: SemanticColors;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  zIndex: typeof zIndex;
}

export const tokens: Tokens = {
  colors: {
    orqenix: brandColors,
    light: semanticLight,
    dark: semanticDark,
  },
  typography,
  spacing,
  radii,
  zIndex,
};

// Default export for convenience
export default tokens;
