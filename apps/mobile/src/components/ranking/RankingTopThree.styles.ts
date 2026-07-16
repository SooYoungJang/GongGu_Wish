import { StyleSheet } from "react-native";

import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { spacing } from "../../design/tokens";

export function makeRankingTopStyles(
  colors: CommerceColorPalette,
  isDark = false,
) {
  return StyleSheet.create({
    compactCard: {
      backgroundColor: colors.panelBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      flex: 1,
      minWidth: 0,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.08 : 0.04,
      shadowRadius: 8,
    },
    compactFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    compactGrid: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    compactInfoColumn: {
      gap: spacing.xxs,
      minWidth: 0,
    },
    compactMainAction: {
      gap: spacing.sm,
    },
    compactMediaColumn: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    compactName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 19,
      minWidth: 0,
    },
    compactThumbnailFallback: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      justifyContent: "center",
    },
    container: {
      gap: spacing.md,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    detailHint: {
      color: colors.weak,
      flex: 1,
      fontSize: 10,
      lineHeight: 14,
    },
    heroCard: {
      backgroundColor: colors.panelBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.1 : 0.05,
      shadowRadius: 10,
    },
    heroFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
    heroInfoColumn: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    heroMainAction: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.md,
      minWidth: 0,
    },
    heroMediaColumn: {
      alignItems: "center",
      gap: spacing.xs,
    },
    heroName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      lineHeight: 24,
      minWidth: 0,
    },
    heroThumbnailFallback: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.md,
      borderWidth: 1,
      justifyContent: "center",
    },
    metricText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
    popularityText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 16,
    },
    pressed: {
      opacity: 0.72,
    },
    price: {
      fontSize: 13,
      lineHeight: 18,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: "900",
    },
    sellerAction: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: 44,
    },
    sellerRow: {
      justifyContent: "center",
      minHeight: 44,
    },
    thumbnailFallbackText: {
      color: colors.muted,
      fontSize: 18,
      fontWeight: "900",
    },
    username: {
      color: colors.weak,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
  });
}
