/**
 * Offload — Design Tokens: Colors
 *
 * Warm off-white paper aesthetic with green accents.
 * Every colour in the app references these tokens — never hardcode hex values.
 */

export const colors = {
  // ─── Backgrounds ───────────────────────────────────
  bg: {
    base: '#F5F0E8',       // deepest layer — app root (aged paper)
    surface: '#EDE8DC',     // cards, sheets
    elevated: '#E5DFCD',    // modals, overlays, input fields (slightly darker for contrast)
    hover: '#E0DBC7',       // interactive hover state
  },

  // ─── Accent ────────────────────────────────────────
  accent: {
    primary: '#7FA688',     // buttons, active tabs, CTAs
    subtle: '#C4D4C0',      // tags, badges, progress fills
    muted: '#5C8A6A',       // selected states, pressed buttons
    glow: 'rgba(127, 166, 136, 0.15)',  // glow halo behind elements
    surface: 'rgba(127, 166, 136, 0.08)', // tinted card bg
  },

  // ─── Text ──────────────────────────────────────────
  text: {
    primary: '#1A1A1A',     // closer to pure black, high contrast
    secondary: '#5C5446',   // darker grey/brown for metadata
    muted: '#8C8474',       // placeholders, disabled
    inverse: '#F5F0E8',     // text on accent buttons (matches base)
  },

  // ─── Borders ───────────────────────────────────────
  border: {
    subtle: '#D4CCBC',      // low-contrast dividers, card borders
    medium: '#B8AF9F',      // focused inputs
    accent: '#7FA688',       // accent-bordered elements
  },

  // ─── Semantic ──────────────────────────────────────
  semantic: {
    success: '#5C8A6A',
    successBg: 'rgba(92, 138, 106, 0.1)',
    error: '#D96C6C',
    errorBg: 'rgba(217, 108, 108, 0.1)',
    warning: '#D4A373',
    warningBg: 'rgba(212, 163, 115, 0.1)',
    info: '#7FA688',
    infoBg: 'rgba(127, 166, 136, 0.1)',
  },

  // ─── Misc ──────────────────────────────────────────
  overlay: 'rgba(44, 44, 44, 0.4)',
  shimmer: {
    base: '#EDE8DC',
    highlight: '#F5F0E8',
  },
} as const;
