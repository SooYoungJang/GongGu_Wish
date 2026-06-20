/**
 * @gonggu/shared/tokens — Design Token Package
 *
 * ★ SINGLE SOURCE OF TRUTH ★
 * Re-exports all design tokens for both platforms.
 *
 * Every visual property used across web & mobile should be
 * sourced from this package, not duplicated per-platform.
 *
 * Usage:
 *   import { colors, spacing, typography } from '@gonggu/shared/tokens';
 *   import { oklchToHex } from '@gonggu/shared/tokens';
 *
 * Platform conversion utilities:
 *   - oklchToHex(oklchStr) → "#rrggbb" hex for React Native
 *   - oklchToRgba(oklchStr) → { r, g, b, a } for RN shadows
 *   - oklchAsCss(oklchStr) → "oklch(...)" passthrough for web
 *   - webFontSize(name) → "1rem" for web CSS
 *   - mobileFontSize(name) → 16 for React Native pt
 *   - webSpacing(name) → "16px" for web CSS
 *   - mobileSpacing(name) → 16 for React Native px
 *   - webRadius(name) → "8px" for web CSS
 *   - mobileRadius(name) → 8 for React Native px
 */

// Color tokens + OKLCH platform conversion utilities
export {
  colors,
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
  parseOklch,
  oklchToHex,
  oklchToRgba,
  oklchToCssRgba,
  oklchToShadowStyle,
  oklchAsCss,
  type PrimaryScale,
  type AccentScale,
  type CtaTokens,
  type CategoryPastelName,
  type CategoryPastelTokens,
  type CardOverlayGradientTokens,
  type NeutralScale,
  type StatusName,
  type ColorCategory,
} from './colors';

// Typography tokens + conversion
export {
  typography,
  fontSizeScale,
  fontWeight,
  lineHeight,
  letterSpacing,
  fontFamilyRoles,
  remToPx,
  webFontSize,
  mobileFontSize,
  type FontSizeName,
  type FontWeightName,
  type LineHeightName,
  type FontSizeEntry,
} from './typography';

// Spacing tokens + conversion
export {
  spacing,
  semanticSpacing,
  webSpacing,
  mobileSpacing,
  type SpacingKey,
  type SemanticSpacingKey,
  type SpacingEntry,
} from './spacing';

// Border radius tokens + conversion
export {
  radii,
  webRadius,
  mobileRadius,
  type RadiusKey,
  type RadiusEntry,
} from './radii';

// Elevation / shadow tokens
export {
  shadows,
  rnShadows,
  type ShadowKey,
  type RNShadowStyle,
} from './elevation';

// Animation / motion tokens
export {
  animation,
  easings,
  durations,
  interactionAnimation,
  transition,
  transitionFast,
  transitionNormal,
  transitionSlow,
  type EasingKey,
  type DurationKey,
  type InteractionKey,
} from './animation';
