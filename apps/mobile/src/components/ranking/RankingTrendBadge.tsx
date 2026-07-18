import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { SText } from "../ui/SText";
import type { CommerceColorPalette } from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type { RankingTrend } from "../../features/ranking/types";

export interface RankingTrendBadgeProps {
  trend: RankingTrend;
}

function getTrendStyle(trend: RankingTrend, colors: CommerceColorPalette) {
  switch (trend.kind) {
    case "up":
      return { label: `▲${trend.delta}위`, text: colors.accent };
    case "down":
      return { label: `▼${trend.delta}위`, text: colors.blue };
    case "new":
      return { label: "NEW", text: colors.success };
    default:
      return { label: "-", text: colors.weak };
  }
}

export function RankingTrendBadge({ trend }: RankingTrendBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getTrendStyle(trend, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <SText variant="caption" style={[styles.text, { color: palette.text }]}>
      {palette.label}
    </SText>
  );
}

function makeStyles() {
  return StyleSheet.create({
    text: {
      fontSize: 11,
      fontWeight: "900",
      minWidth: 24,
      textAlign: "center",
    },
  });
}
