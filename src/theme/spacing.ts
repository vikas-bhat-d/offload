/**
 * Offload — Design Tokens: Spacing
 *
 * 4px base grid. Every margin/padding references this scale.
 */

export const spacing = {
  /** 2px */  xxs: 2,
  /** 4px */  xs: 4,
  /** 8px */  sm: 8,
  /** 12px */ md: 12,
  /** 16px */ base: 16,
  /** 20px */ lg: 20,
  /** 24px */ xl: 24,
  /** 32px */ '2xl': 32,
  /** 40px */ '3xl': 40,
  /** 48px */ '4xl': 48,
  /** 56px */ '5xl': 56,
  /** 64px */ '6xl': 64,
} as const;

export const borderRadius = {
  /** 4px  */ xs: 4,
  /** 8px  */ sm: 8,
  /** 12px */ md: 12,
  /** 16px */ lg: 16,
  /** 20px */ xl: 20,
  /** 24px */ '2xl': 24,
  /** 999  */ full: 999,
} as const;
