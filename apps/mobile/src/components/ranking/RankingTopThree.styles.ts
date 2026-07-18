import { StyleSheet } from "react-native";

import type { useCommerceTheme } from "../../design/useCommerceTheme";

export function makeRankingTopStyles(
  theme: ReturnType<typeof useCommerceTheme>,
) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    cardFooter: {
      alignItems: "center",
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      marginTop: spacing.sm,
      minHeight: 52,
      paddingTop: spacing.xs,
    },
    cardFooterLargeText: {
      alignItems: "stretch",
      flexDirection: "column",
    },
    commerceRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    compactCard: {
      backgroundColor: colors.cardBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: radius.xl,
      borderWidth: 1,
      flex: 1,
      minWidth: 0,
      padding: spacing.sm,
    },
    compactGrid: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    compactGridLargeText: {
      flexDirection: "column",
    },
    compactInfo: {
      flex: 1,
      gap: spacing.xs,
      justifyContent: "center",
      minWidth: 0,
    },
    compactMainAction: {
      flex: 1,
      gap: spacing.sm,
      minWidth: 0,
    },
    compactMainActionLargeText: {
      alignItems: "stretch",
    },
    compactMedia: {
      aspectRatio: 1,
      backgroundColor: colors.softBg,
      borderCurve: "continuous",
      borderRadius: radius.lg,
      overflow: "hidden",
      width: "100%",
    },
    compactName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 21,
      minWidth: 0,
    },
    container: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: spacing.md,
    },
    deadline: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 16,
    },
    heroCard: {
      backgroundColor: colors.cardBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: radius.xxl,
      borderWidth: 1,
      padding: spacing.md,
    },
    heroInfo: {
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    heroMainAction: {
      gap: spacing.md,
    },
    heroMedia: {
      aspectRatio: 1.5,
      backgroundColor: colors.softBg,
      borderCurve: "continuous",
      borderRadius: radius.xl,
      overflow: "hidden",
      width: "100%",
    },
    heroName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 27,
      minWidth: 0,
    },
    heroPopularityOverlay: {
      backgroundColor: colors.accent,
      borderCurve: "continuous",
      borderRadius: radius.full,
      bottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      position: "absolute",
      right: spacing.sm,
    },
    heroPopularityText: {
      color: colors.inverse,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    imageFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      backgroundColor: colors.softBg,
      gap: spacing.sm,
      justifyContent: "center",
      padding: spacing.sm,
    },
    imageFallbackLabel: {
      ...typography.meta,
      color: colors.weak,
      textAlign: "center",
    },
    imageFallbackMark: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderCurve: "continuous",
      borderRadius: radius.full,
      height: spacing.xxl * 2,
      justifyContent: "center",
      width: spacing.xxl * 2,
    },
    imageFallbackText: {
      ...typography.pageTitle,
      color: colors.accent,
    },
    popularityPill: {
      backgroundColor: colors.accentSoft,
      borderCurve: "continuous",
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    popularityPillText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 16,
    },
    pressed: {
      opacity: 0.72,
    },
    price: {
      fontSize: 14,
      lineHeight: 20,
    },
    productImage: {
      height: "100%",
      width: "100%",
    },
    proofText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
    rankOverlay: {
      alignItems: "center",
      backgroundColor: colors.cardBg,
      borderCurve: "continuous",
      borderRadius: radius.full,
      flexDirection: "row",
      gap: spacing.xs,
      left: spacing.sm,
      padding: spacing.xxs,
      position: "absolute",
      top: spacing.sm,
    },
    reasonText: {
      color: colors.accent,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 17,
    },
    sectionSubtitle: {
      color: colors.muted,
      lineHeight: 18,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 27,
    },
    sellerAction: {
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      minWidth: 0,
    },
    signalRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    titleBlock: {
      gap: spacing.xxs,
    },
    username: {
      color: colors.weak,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
  });
}
