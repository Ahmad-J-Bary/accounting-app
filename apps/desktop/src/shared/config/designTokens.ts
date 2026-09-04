/**
 * Design Tokens — Single source of truth for all design decisions.
 * These values mirror and extend the CSS variables in index.css.
 */

// ── Typography ──────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: '"Cairo", "Tajawal", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
    arabic: '"Cairo", "Tajawal", system-ui, sans-serif',
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '2rem', // 32px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ── Spacing Scale ───────────────────────────────────────────
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem', // 12px
  3.5: '0.875rem', // 14px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  7: '1.75rem', // 28px
  8: '2rem', // 32px
  9: '2.25rem', // 36px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  14: '3.5rem', // 56px
  16: '4rem', // 64px
} as const;

// ── Border Radius ───────────────────────────────────────────
export const radii = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  '2xl': '1rem', // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
} as const;

// ── Shadows ─────────────────────────────────────────────────
export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  none: '0 0 #0000',
} as const;

// ── Breakpoints ─────────────────────────────────────────────
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ── Z-Index Scale ───────────────────────────────────────────
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  'modal-backdrop': 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ── Transitions ─────────────────────────────────────────────
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ── Density Presets ─────────────────────────────────────────
export const densityPresets = {
  compact: {
    spacing: {
      xs: '0.125rem',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
    },
    fontSize: {
      sm: '0.6875rem',
      base: '0.8125rem',
    },
    rowHeight: '2rem',
  },
  comfortable: {
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '0.75rem',
      lg: '1rem',
      xl: '1.5rem',
    },
    fontSize: {
      sm: '0.75rem',
      base: '0.875rem',
    },
    rowHeight: '2.5rem',
  },
  spacious: {
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    fontSize: {
      sm: '0.8125rem',
      base: '0.9375rem',
    },
    rowHeight: '3rem',
  },
} as const;

// ── Animation Durations ─────────────────────────────────────
export const durations = {
  instant: '0ms',
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

// ── Sidebar Density Presets (matches CSS in index.css) ──────
export const sidebarDensityPresets = {
  compact: {
    fieldGap: '0.25rem',
    sectionGap: '0.75rem',
    contentGap: '1rem',
    containerPy: '0.75rem',
    containerPx: '1rem',
    labelSize: '0.65rem',
    fieldPy: '0.25rem',
  },
  comfortable: {
    fieldGap: '0.5rem',
    sectionGap: '1rem',
    contentGap: '1.5rem',
    containerPy: '1rem',
    containerPx: '1.5rem',
    labelSize: '0.75rem',
    fieldPy: '0.375rem',
  },
  spacious: {
    fieldGap: '0.75rem',
    sectionGap: '1.5rem',
    contentGap: '2rem',
    containerPy: '1.25rem',
    containerPx: '2rem',
    labelSize: '0.8125rem',
    fieldPy: '0.5rem',
  },
} as const;
