import { StyleSheet } from "react-native";

import type { useCommerceTheme } from "../../design/useCommerceTheme";

export function makeNativeAdStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;
  const borderedSurface = {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
  } as const;

  return StyleSheet.create({
    card: {
      ...borderedSurface,
      flexBasis: "100%",
      marginBottom: spacing.cardGap,
      width: "100%",
    },
    tile: {
      flexBasis: "47%",
      flexGrow: 1,
      maxWidth: "47%",
      minHeight: 206,
      minWidth: 0,
    },
    row: {
      ...borderedSurface,
      flexDirection: "row",
      minHeight: 124,
      overflow: "hidden",
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
    compactLabelRow: {
      alignItems: "flex-start",
    },
    compactMediaLabelRow: {
      left: spacing.sm,
      position: "absolute",
      top: spacing.sm,
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
      alignItems: "center",
      backgroundColor: "#000000",
      justifyContent: "center",
      overflow: "hidden",
    },
    tileMediaFrame: {
      aspectRatio: 1,
      backgroundColor: colors.softBg,
      borderRadius: radius.lg,
      overflow: "hidden",
      width: "100%",
    },
    rowMediaFrame: {
      alignSelf: "stretch",
      backgroundColor: colors.softBg,
      overflow: "hidden",
      width: 120,
    },
    cardMedia: {
      backgroundColor: colors.softBg,
      width: "100%",
    },
    reelMedia: {
      backgroundColor: "#000000",
    },
    compactMedia: {
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
    tileContent: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
      paddingTop: spacing.sm,
    },
    rowContent: {
      flex: 1,
      gap: spacing.xs,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
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
    compactTitleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    compactTitleCopy: {
      flex: 1,
      gap: spacing.xxs,
      minWidth: 0,
    },
    icon: {
      borderRadius: radius.sm,
      height: 48,
      width: 48,
    },
    compactIcon: {
      borderRadius: radius.sm,
      height: 28,
      width: 28,
    },
    cardHeadline: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    reelHeadline: {
      ...typography.bodyStrong,
      color: "#FFFFFF",
    },
    compactHeadline: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 19,
    },
    cardBody: {
      ...typography.meta,
      color: colors.muted,
    },
    reelBody: {
      ...typography.meta,
      color: "rgba(255, 255, 255, 0.82)",
    },
    compactBody: {
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 16,
    },
    footer: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    compactFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "space-between",
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
    compactAdvertiser: {
      color: colors.weak,
      flexShrink: 1,
      fontSize: 11,
      lineHeight: 15,
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
    compactCallToAction: {
      ...typography.badge,
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      color: colors.inverse,
      minHeight: 36,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: 9,
      textAlign: "center",
    },
  });
}
