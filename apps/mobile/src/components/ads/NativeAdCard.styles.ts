import { StyleSheet } from "react-native";

import type { useCommerceTheme } from "../../design/useCommerceTheme";

export function makeNativeAdStyles(
  theme: ReturnType<typeof useCommerceTheme>,
) {
  const { colors, radius, spacing, typography } = theme;

  return StyleSheet.create({
    card: {
      backgroundColor: colors.cardBg,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexBasis: "100%",
      marginBottom: spacing.cardGap,
      width: "100%",
    },
    reel: {
      backgroundColor: "#000000",
      flex: 1,
      overflow: "hidden",
      width: "100%",
    },
    cardLabelRow: {
      alignItems: "flex-start",
      paddingHorizontal: spacing.md,
      paddingRight: 56,
      paddingVertical: spacing.sm,
    },
    reelLabelRow: {
      alignItems: "flex-start",
      left: spacing.lg,
      position: "absolute",
      top: spacing.lg,
      zIndex: 2,
    },
    adLabel: {
      ...typography.badge,
      backgroundColor: "rgba(15, 23, 42, 0.78)",
      borderRadius: radius.xs,
      color: "#FFFFFF",
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    cardMediaFrame: {
      backgroundColor: colors.softBg,
      borderRadius: radius.md,
      marginHorizontal: spacing.md,
      overflow: "hidden",
    },
    reelMediaFrame: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#000000",
    },
    cardMedia: {
      backgroundColor: colors.softBg,
      width: "100%",
    },
    reelMedia: {
      flex: 1,
      width: "100%",
    },
    cardContent: {
      gap: spacing.md,
      padding: spacing.md,
    },
    reelContent: {
      backgroundColor: "rgba(0, 0, 0, 0.68)",
      bottom: 0,
      gap: spacing.md,
      left: 0,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      position: "absolute",
      right: 0,
    },
    titleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.md,
    },
    titleCopy: {
      flex: 1,
      gap: spacing.sm,
    },
    icon: {
      borderRadius: radius.sm,
      height: 48,
      width: 48,
    },
    cardHeadline: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    reelHeadline: {
      ...typography.bodyStrong,
      color: "#FFFFFF",
    },
    cardBody: {
      ...typography.meta,
      color: colors.muted,
    },
    reelBody: {
      ...typography.meta,
      color: "rgba(255, 255, 255, 0.82)",
    },
    footer: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    cardAdvertiser: {
      ...typography.meta,
      color: colors.weak,
      flexShrink: 1,
    },
    reelAdvertiser: {
      ...typography.meta,
      color: "rgba(255, 255, 255, 0.72)",
      flexShrink: 1,
    },
    callToAction: {
      ...typography.badge,
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      color: colors.inverse,
      minHeight: 44,
      overflow: "hidden",
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      textAlign: "center",
    },
  });
}
