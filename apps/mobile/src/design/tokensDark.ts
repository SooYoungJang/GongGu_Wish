/**
 * @gonggu/mobile — Dark Mode Design Tokens
 *
 * Aligned to the commerce redesign: near-black canvas, charcoal surfaces,
 * soft gray typography, and pink-red deal accents. These values back the
 * existing theme context so legacy design-system components and the new
 * commerce components resolve the same light/dark mood.
 */

import type { ShadowStyle } from './tokens';

export const colorsDark = {
  primary: '#FF4E6A',
  primaryLight: '#FF7B90',
  primaryDark: '#F0445E',
  primaryBg: '#3A2029',

  accent: '#FF4E6A',
  accentLight: '#FF7B90',
  accentBg: '#3A2029',

  ctaPurple: '#8B7CFF',
  ctaPurpleHover: '#7868F2',
  ctaPurpleText: '#FFFFFF',
  ctaPurpleBg: '#252146',

  bg: '#17181D',
  surface: '#1C1D23',
  surfaceHover: '#2B2C34',

  textPrimary: '#F4F5F8',
  textSecondary: '#B5B7C1',
  textTertiary: '#7D808B',
  textInverse: '#FFFFFF',
  textLink: '#FF6B82',

  border: '#343641',
  borderLight: '#272932',
  divider: '#252731',

  success: '#41D37E',
  successBg: '#173425',
  warning: '#FFD166',
  warningBg: '#3A2E19',
  error: '#FF6B6B',
  errorBg: '#3A2020',

  statusPendingBg: '#3A2E19',
  statusPendingText: '#FFD166',
  statusPendingBorder: '#6B5529',
  statusApprovedBg: '#173425',
  statusApprovedText: '#41D37E',
  statusApprovedBorder: '#2E684A',
  statusRejectedBg: '#3A2020',
  statusRejectedText: '#FF8A8A',
  statusRejectedBorder: '#744040',
  statusReviewBg: '#1F2B45',
  statusReviewText: '#7BB6FF',
  statusReviewBorder: '#35507D',
  statusDuplicateBg: '#24252D',
  statusDuplicateText: '#9EA1AD',
  statusDuplicateBorder: '#3C3F4A',

  categoryBeautyBg: '#3A2029',
  categoryBeautyText: '#FF9AAA',
  categoryBeautyBorder: '#5A2E3A',
  categoryFashionBg: '#2D2444',
  categoryFashionText: '#C8B7FF',
  categoryFashionBorder: '#443664',
  categoryFoodBg: '#3A2E19',
  categoryFoodText: '#FFD166',
  categoryFoodBorder: '#5E4922',
  categoryLifestyleBg: '#173039',
  categoryLifestyleText: '#7ED7E8',
  categoryLifestyleBorder: '#28545F',
  categoryBabyBg: '#173425',
  categoryBabyText: '#8DE3B0',
  categoryBabyBorder: '#28553D',
  categoryDigitalBg: '#1F2B45',
  categoryDigitalText: '#8ABEFF',
  categoryDigitalBorder: '#31486D',

  rankingTop1Bg: '#3A2E19',
  rankingTop1Text: '#FFD166',
  rankingTop2Bg: '#242833',
  rankingTop2Text: '#C7CBD6',
  rankingTop3Bg: '#3A271A',
  rankingTop3Text: '#E8A974',
  rankingDefaultBg: '#24252D',
  rankingDefaultText: '#9EA1AD',

  rankingAdBg: '#1F2B45',
  rankingAdText: '#7BB6FF',
  rankingAdBorder: '#35507D',

  rankingMovementUpBg: '#173425',
  rankingMovementUpText: '#41D37E',
  rankingMovementDownBg: '#3A2020',
  rankingMovementDownText: '#FF8A8A',
  rankingMovementSameBg: '#24252D',
  rankingMovementSameText: '#9EA1AD',
  rankingMovementNewBg: '#1F2B45',
  rankingMovementNewText: '#7BB6FF',

  rankingFollowingActiveBg: '#3A2029',
  rankingFollowingActiveText: '#FF7B90',
  rankingFollowingInactiveBg: '#24252D',
  rankingFollowingInactiveText: '#B5B7C1',

  skeleton: '#2D303A',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.72)',
  badgeBg: '#3A2029',
  badgeText: '#FF7B90',
  noticeText: '#FFD166',

  cardOverlayTop: 'rgba(0, 0, 0, 0)',
  cardOverlayMiddle: 'rgba(0, 0, 0, 0.18)',
  cardOverlayBottom: 'rgba(0, 0, 0, 0.62)',
} as const;

export const shadowsDark: Record<'sm' | 'md' | 'lg', ShadowStyle> = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 6,
  },
};

export type DarkColorKey = keyof typeof colorsDark;
