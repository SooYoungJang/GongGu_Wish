/**
 * @gonggu/shared/tokens — Border Radius Tokens
 *
 * ★ SINGLE SOURCE OF TRUTH ★
 * Shared border radius values for both platforms.
 *
 * Platform differences:
 *   - Web: smaller sm/md for tighter UI
 *   - Mobile: larger sm/md for thumb-friendly touch targets
 *   - Both: lg, xl, 2xl, 3xl, full are identical
 */

export interface RadiusEntry {
  /** CSS px value for web */
  web: string;
  /** Numeric px value for React Native */
  mobile: number;
}

export const radii: Record<string, RadiusEntry> = {
  /** 0px — none */
  none: { web: '0', mobile: 0 },
  /** Web: 4px, Mobile: 8px — small elements (checkboxes, small badges) */
  sm: { web: '4px', mobile: 8 },
  /** Web: 8px, Mobile: 10px — default (buttons, inputs, cards) */
  md: { web: '8px', mobile: 10 },
  /** 12px — modals, feature cards */
  lg: { web: '12px', mobile: 12 },
  /** 16px — hero cards, bottom sheets */
  xl: { web: '16px', mobile: 16 },
  /** 24px — extra large radius */
  '2xl': { web: '24px', mobile: 24 },
  /** 28px — premium banner radius */
  '3xl': { web: '28px', mobile: 28 },
  /** 9999px — pills, avatars, badges */
  full: { web: '9999px', mobile: 999 },
} as const;

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Get web CSS border-radius value by name
 */
export function webRadius(name: keyof typeof radii): string {
  return radii[name].web;
}

/**
 * Get mobile numeric border-radius value by name
 */
export function mobileRadius(name: keyof typeof radii): number {
  return radii[name].mobile;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RadiusKey = keyof typeof radii;
