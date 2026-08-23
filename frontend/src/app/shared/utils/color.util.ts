const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeHex(hex: string | undefined | null, fallback: string): string {
  return hex && HEX_RE.test(hex.trim()) ? hex.trim() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / delta) % 6); break;
      case g: h = 60 * ((b - r) / delta + 2); break;
      default: h = 60 * ((r - g) / delta + 4); break;
    }
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Shifts HSL lightness by `percent` points (-100..100), mirroring Sass's darken()/lighten(). */
function shiftLightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const l = Math.max(0, Math.min(1, hsl.l + percent / 100));
  const rgb = hslToRgb(hsl.h, hsl.s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
}

export const DEFAULT_PRIMARY_COLOR = '#006B8F';

/**
 * Derives the primary/dark/light trio from a single brand color, falling back to
 * DEFAULT_PRIMARY_COLOR when `primaryHex` is missing or not a valid #rrggbb hex.
 * The -8% / +7% lightness offsets reproduce the original hand-picked palette
 * (#004d66 / #006B8F / #0088b3) exactly when the default color is used.
 */
export function deriveThemeColors(primaryHex: string | undefined | null): ThemeColors {
  const primary = normalizeHex(primaryHex, DEFAULT_PRIMARY_COLOR);
  return {
    primary,
    primaryDark: shiftLightness(primary, -8),
    primaryLight: shiftLightness(primary, 7),
  };
}
