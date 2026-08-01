import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { SText } from "../ui/SText";
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type { RankingTrend } from "../../features/ranking/types";

export interface RankingTrendBadgeProps {
  trend: RankingTrend;
}

function getTrendStyle(trend: RankingTrend, colors: CommerceColorPalette) {
  switch (trend.kind) {
    case "up":
      return {
        background: colors.accentSoft,
        label: `▲${trend.delta}위`,
        text: colors.accent,
      };
    case "down":
      return {
        background: colors.blueSoft,
        label: `▼${trend.delta}위`,
        text: colors.blue,
      };
    case "new":
      return {
        background: colors.successSoft,
        label: "NEW",
        text: colors.success,
      };
    default:
      return {
        background: colors.softBg,
        label: "-",
        text: colors.weak,
      };
  }
}

export function RankingTrendBadge({ trend }: RankingTrendBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getTrendStyle(trend, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View
      style={[styles.badge, { backgroundColor: palette.background }]}
      testID={`ranking-trend-badge-${trend.kind}`}
    >
      <SText
        numberOfLines={1}
        variant="caption"
        style={[styles.text, { color: palette.text }]}
      >
        {palette.label}
      </SText>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    badge: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: commerceRadius.full,
      justifyContent: "center",
      minHeight: 24,
      paddingHorizontal: commerceSpacing.xs,
      paddingVertical: commerceSpacing.xxs,
    },
    text: {
      fontSize: 11,
      fontWeight: "900",
      includeFontPadding: false,
      lineHeight: 16,
      minWidth: 24,
      textAlign: "center",
    },
  });
}
