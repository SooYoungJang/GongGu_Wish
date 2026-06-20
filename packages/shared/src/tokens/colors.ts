/**
 * @gonggu/shared/tokens — Color Tokens
 *
 * ★ SINGLE SOURCE OF TRUTH ★
 * All colors defined in OKLCH for cross-platform consistency.
 * Platform-specific conversion utilities provided at the bottom.
 *
 * Architecture:
 *   primary  — brand blue (v2 unified: oklch(0.58 0.22 260))
 *   accent   — Instagram pink (#e1306c / oklch(0.6 0.21 7))
 *   semantic — status colors (success, warning, error)
 *   neutral  — gray scale (warm-tinted)
 *   surface  — background & surface tokens
 *   text     — text color tokens
 *   border   — border & divider tokens
 *   overlay  — shadow/shade tokens
 *
 * Usage:
 *   Web:         oklch(...) string → CSS custom property
 *   Mobile RN:   oklchToHex() helper → hex string
 *   Mobile RN:   oklchToRgba() helper → {r,g,b,a} for RN shadows
 */

// ============================================================================
// OKLCH COLOR SCALES
// ============================================================================

/**
 * Primary brand — Cool blue
 * v2 unified value: oklch(0.58 0.22 260) — slightly deeper hue than Tailwind blue-500
 * Hue 260 = blue-violet quadrant, between Tailwind blue (252°) and indigo (270°)
 */
export const primary = {
  50: 'oklch(0.97 0.03 260)',
  100: 'oklch(0.93 0.06 260)',
  200: 'oklch(0.88 0.1 260)',
  300: 'oklch(0.81 0.15 260)',
  400: 'oklch(0.71 0.19 260)',
  500: 'oklch(0.58 0.22 260)',  // ★ v2 unified brand color
  600: 'oklch(0.51 0.22 260)',
  700: 'oklch(0.44 0.2 260)',
  800: 'oklch(0.37 0.17 260)',
  900: 'oklch(0.31 0.14 260)',
  950: 'oklch(0.26 0.11 260)',
} as const;

/**
 * Accent — Instagram pink (#e1306c)
 * Hue 7 = red-pink quadrant. Lightness 0.6, Chroma 0.21
 */
export const accent = {
  50: 'oklch(0.97 0.02 355)',
  100: 'oklch(0.93 0.05 355)',
  200: 'oklch(0.86 0.1 355)',
  300: 'oklch(0.77 0.15 355)',
  400: 'oklch(0.69 0.19 355)',
  500: 'oklch(0.6 0.21 7)',    // ★ Instagram pink #e1306c
  600: 'oklch(0.52 0.21 355)',
  700: 'oklch(0.44 0.19 355)',
  800: 'oklch(0.37 0.17 355)',
  900: 'oklch(0.31 0.14 355)',
  950: 'oklch(0.26 0.11 355)',
} as const;

/**
 * CTA purple — high-emphasis action color for Home redesign CTAs.
 * Kept separate from primary/accent so existing brand and Instagram accent
 * semantics remain stable.
 */
export const cta = {
  purple: 'oklch(0.58 0.24 300)',
  purpleHover: 'oklch(0.52 0.25 300)',
  purpleText: 'oklch(1 0 0)',
  purpleBg: 'oklch(0.97 0.035 300)',
} as const;

/**
 * Category pastel palette — soft, feed-friendly chips/cards for Home sections.
 * Usage intent: beauty, fashion, food, lifestyle, baby, digital. Names are
 * domain aliases rather than hard requirements; consumers may map by category.
 */
export const categoryPastel = {
  beauty: {
    bg: 'oklch(0.95 0.045 350)',
    text: 'oklch(0.48 0.14 350)',
    border: 'oklch(0.88 0.06 350)',
  },
  fashion: {
    bg: 'oklch(0.95 0.04 285)',
    text: 'oklch(0.46 0.13 285)',
    border: 'oklch(0.87 0.055 285)',
  },
  food: {
    bg: 'oklch(0.96 0.055 85)',
    text: 'oklch(0.48 0.12 85)',
    border: 'oklch(0.88 0.07 85)',
  },
  lifestyle: {
    bg: 'oklch(0.95 0.04 185)',
    text: 'oklch(0.43 0.11 185)',
    border: 'oklch(0.86 0.055 185)',
  },
  baby: {
    bg: 'oklch(0.96 0.04 145)',
    text: 'oklch(0.42 0.12 145)',
    border: 'oklch(0.87 0.06 145)',
  },
  digital: {
    bg: 'oklch(0.95 0.04 250)',
    text: 'oklch(0.45 0.13 250)',
    border: 'oklch(0.87 0.055 250)',
  },
} as const;

/**
 * Card overlay gradients — used over product/media cards to preserve text
 * readability without changing the underlying surface/card tokens.
 */
export const cardOverlayGradient = {
  top: 'oklch(0 0 0 / 0)',
  middle: 'oklch(0 0 0 / 0.18)',
  bottom: 'oklch(0 0 0 / 0.62)',
} as const;

/**
 * Semantic status colors
 */
export const success = {
  50: 'oklch(0.97 0.03 142)',
  100: 'oklch(0.93 0.08 142)',
  500: 'oklch(0.65 0.2 142)',
  600: 'oklch(0.58 0.19 142)',
} as const;

export const warning = {
  50: 'oklch(0.98 0.02 90)',
  100: 'oklch(0.95 0.06 90)',
  500: 'oklch(0.77 0.18 90)',
  600: 'oklch(0.7 0.17 90)',
} as const;

export const error = {
  50: 'oklch(0.98 0.01 25)',
  100: 'oklch(0.94 0.04 25)',
  500: 'oklch(0.62 0.22 25)',
  600: 'oklch(0.55 0.21 25)',
} as const;

/**
 * Status-specific badge tokens
 */
export const status = {
  pending: {
    bg: 'oklch(0.98 0.02 90)',
    text: 'oklch(0.7 0.17 90)',
    border: 'oklch(0.9 0.1 90)',
  },
  approved: {
    bg: 'oklch(0.97 0.03 142)',
    text: 'oklch(0.58 0.19 142)',
    border: 'oklch(0.85 0.1 142)',
  },
  rejected: {
    bg: 'oklch(0.98 0.01 25)',
    text: 'oklch(0.55 0.21 25)',
    border: 'oklch(0.9 0.08 25)',
  },
  review: {
    bg: 'oklch(0.97 0.03 260)',
    text: 'oklch(0.51 0.22 260)',
    border: 'oklch(0.88 0.1 260)',
  },
  duplicate: {
    bg: 'oklch(0.97 0.005 250)',
    text: 'oklch(0.55 0.01 250)',
    border: 'oklch(0.9 0.01 250)',
  },
} as const;

/**
 * Neutral / Gray scale — warm-tinted (hue 250 = cool gray with minimal chromatic)
 */
export const neutral = {
  0: 'oklch(1 0 0)',
  50: 'oklch(0.98 0.005 250)',
  100: 'oklch(0.96 0.01 250)',
  200: 'oklch(0.9 0.01 250)',
  300: 'oklch(0.82 0.01 250)',
  400: 'oklch(0.7 0.01 250)',
  500: 'oklch(0.55 0.01 250)',
  600: 'oklch(0.45 0.01 250)',
  700: 'oklch(0.37 0.01 250)',
  800: 'oklch(0.27 0.01 250)',
  900: 'oklch(0.21 0.01 250)',
  950: 'oklch(0.15 0.01 250)',
} as const;

/**
 * Surface / Background tokens
 */
export const surface = {
  primary: 'oklch(1 0 0)',
  secondary: 'oklch(0.98 0.005 250)',
  tertiary: 'oklch(0.96 0.01 250)',
  inverse: 'oklch(0.21 0.01 250)',
} as const;

/**
 * Text color tokens
 */
export const text = {
  primary: 'oklch(0.21 0.01 250)',
  secondary: 'oklch(0.45 0.01 250)',
  tertiary: 'oklch(0.55 0.01 250)',
  inverse: 'oklch(1 0 0)',
  disabled: 'oklch(0.7 0.01 250)',
  link: 'oklch(0.58 0.22 260)',
} as const;

/**
 * Border & divider tokens
 */
export const border = {
  primary: 'oklch(0.9 0.01 250)',
  secondary: 'oklch(0.82 0.01 250)',
  focus: 'oklch(0.58 0.22 260)',
  error: 'oklch(0.62 0.22 25)',
} as const;

/**
 * Overlay / shadow tokens
 */
export const overlay = {
  backdrop: 'oklch(0 0 0 / 0.5)',
  modal: 'oklch(0 0 0 / 0.08)',
  toast: 'oklch(0 0 0 / 0.12)',
  card: 'oklch(0 0 0 / 0.06)',
} as const;

// ============================================================================
// COMPOSITE COLORS EXPORT
// ============================================================================

export const colors = {
  primary,
  accent,
  cta,
  categoryPastel,
  cardOverlayGradient,
  success,
  warning,
  error,
  status,
  neutral,
  surface,
  text,
  border,
  overlay,
} as const;

// ============================================================================
// PLATFORM CONVERSION UTILITIES
// ============================================================================

/**
 * Parse an OKLCH string like "oklch(0.58 0.22 260)" or "oklch(0 0 0 / 0.5)"
 * Returns { l, c, h, alpha? }
 */
export function parseOklch(value: string): {
  l: number;
  c: number;
  h: number;
  alpha?: number;
} {
  const cleaned = value.replace(/oklch\(|\)/g, '').trim();
  const parts = cleaned.split(/\s+/);

  if (parts.length >= 3) {
    const l = parseFloat(parts[0]);
    const c = parseFloat(parts[1]);
    const h = parseFloat(parts[2]);
    const alpha = parts[4]
      ? parseFloat(parts[4].replace('/', ''))
      : undefined;
    return { l, c, h, alpha };
  }

  return { l: 0, c: 0, h: 0 };
}

/**
 * Linearize an sRGB channel value (0-1 range)
 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Delinearize an sRGB channel value (0-1 range to 0-255)
 */
function delinearize(c: number): number {
  const s = c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

/**
 * OKLCH → linear sRGB conversion matrix
 * Based on Björn Ottosson's OKLab/OKLCH specification
 */
function oklabToLinearRgb(l: number, a: number, b: number): [number, number, number] {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

/**
 * Convert OKLCH to sRGB hex string (#rrggbb)
 */
export function oklchToHex(oklchStr: string): string {
  const { l, c, h } = parseOklch(oklchStr);

  // Convert polar to Cartesian (OKLab a, b)
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab → linear sRGB
  const [rLin, gLin, bLin] = oklabToLinearRgb(l, a, b);

  // Linear sRGB → sRGB → hex
  const r = delinearize(rLin);
  const g = delinearize(gLin);
  const bl = delinearize(bLin);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Convert OKLCH to RGBA object for React Native shadows
 * Returns { r, g, b, a } where r/g/b are 0-255 integers
 */
export function oklchToRgba(oklchStr: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const { l, c, h, alpha } = parseOklch(oklchStr);

  const hRad = (h * Math.PI) / 180;
  const aOklab = c * Math.cos(hRad);
  const bOklab = c * Math.sin(hRad);

  const [rLin, gLin, bLin] = oklabToLinearRgb(l, aOklab, bOklab);

  return {
    r: delinearize(rLin),
    g: delinearize(gLin),
    b: delinearize(bLin),
    a: alpha ?? 1,
  };
}

/**
 * Convert OKLCH to CSS rgba() string
 * Useful for React Native `shadowColor` prop which requires a single value
 */
export function oklchToCssRgba(oklchStr: string): string {
  const { r, g, b, a } = oklchToRgba(oklchStr);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Convert OKLCH to React Native shadow style
 * Platform-aware: web OKLCH → RN { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }
 */
export function oklchToShadowStyle(
  oklchStr: string,
  offsetY: number,
  radius: number,
): {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
} {
  const { r, g, b, a } = oklchToRgba(oklchStr);
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: a,
    shadowRadius: radius,
    elevation: radius > 8 ? 4 : radius > 4 ? 2 : 1,
  };
}

/**
 * Get the CSS oklch() string as-is (for web usage via CSS custom properties)
 */
export function oklchAsCss(oklchStr: string): string {
  return oklchStr;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PrimaryScale = typeof primary;
export type AccentScale = typeof accent;
export type CtaTokens = typeof cta;
export type CategoryPastelName = keyof typeof categoryPastel;
export type CategoryPastelTokens = typeof categoryPastel;
export type CardOverlayGradientTokens = typeof cardOverlayGradient;
export type NeutralScale = typeof neutral;
export type StatusName = keyof typeof status;
export type ColorCategory = keyof typeof colors;
