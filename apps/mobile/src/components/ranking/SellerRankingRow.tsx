import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { SText } from "../ui/SText";
import { PriceText } from "../ui/PriceText";
import { spacing } from "../../design/tokens";
import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
} from "../../features/ranking/types";
import { formatCompactCount } from "../../features/ranking/types";
import { GroupBuyAlertButton } from "./FollowButton";
import { RankBadge } from "./RankBadge";
import { RankingTrendBadge } from "./RankingTrendBadge";
import { ThumbnailStrip } from "./ThumbnailStrip";

type RankingItemAction = (...args: [GroupBuyRankingItem]) => void;

export interface SellerRankingRowProps {
  item: RankingListItem;
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
}

export function SellerRankingRow({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
}: SellerRankingRowProps) {
  const { colors, isDark } = useCommerceTheme();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const compact = width <= 360;
  const thumbnailSize = compact ? 64 : 72;
  const displayName = item.productName ?? item.brandName ?? item.username;
  const viewCount = formatCompactCount(item.metrics.deepViews);
  const savedCount = formatCompactCount(item.metrics.bookmarks);
  const notificationCount = formatCompactCount(item.metrics.notifications);
  const popularityScore = Math.round(item.metrics.score);
  const thumbnails = item.thumbnailUrl
    ? [
        {
          id: `${item.groupBuyId}-thumbnail`,
          imageUrl: item.thumbnailUrl,
          label: displayName,
        },
      ]
    : item.mediaUrls.slice(0, 3).map((imageUrl, index) => ({
        id: `${item.groupBuyId}-media-${index}`,
        imageUrl,
        label: displayName,
      }));
  const accessibilityLabel = `${item.rank}위 ${displayName}, 조회 ${viewCount}, 저장 ${savedCount}`;

  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handleToggleAlert = useCallback(
    () => onToggleAlert(item),
    [item, onToggleAlert],
  );

  return (
    <View testID={`ranking-row-${item.rank}`} style={[s.row, s.cardRow]}>
      <View style={s.mainRow}>
        <Pressable
          accessibilityHint="공구 상세 보기"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={handlePress}
          style={({ pressed }) => [s.mainAction, pressed && s.pressed]}
        >
          <View style={s.rankColumn}>
            <RankBadge rank={item.rank} />
            <RankingTrendBadge trend={item.trend} />
          </View>

          {thumbnails.length > 0 ? (
            <ThumbnailStrip
              maxVisible={1}
              size={thumbnailSize}
              thumbnails={thumbnails}
            />
          ) : (
            <View
              style={[
                s.thumbnailFallback,
                { height: thumbnailSize, width: thumbnailSize },
              ]}
            >
              <SText variant="caption" style={s.thumbnailFallbackText}>
                {displayName.charAt(0)}
              </SText>
            </View>
          )}

          <View style={s.infoColumn}>
            <SText variant="body" style={s.sellerName} numberOfLines={2}>
              {displayName}
            </SText>

            <PriceText priceKrw={item.priceKrw} style={s.price} />

            <SText variant="caption" style={s.metricText} numberOfLines={1}>
              조회 {viewCount} · 저장 {savedCount} · 알림 {notificationCount}
            </SText>

            <SText variant="caption" style={s.popularityText}>
              인기지수 {popularityScore}
            </SText>
          </View>
        </Pressable>

        <View style={s.actionColumn}>
          <GroupBuyAlertButton
            groupBuyName={displayName}
            isEnabled={item.isNotifying ?? false}
            notificationState={item.notificationState}
            onPress={handleToggleAlert}
          />
        </View>
      </View>

      <View style={s.sellerRow}>
        {onPressSeller ? (
          <Pressable
            accessibilityHint="판매자의 공구 목록 보기"
            accessibilityLabel={`@${item.username} 판매자 공구 보기`}
            accessibilityRole="button"
            onPress={() => onPressSeller(item)}
            style={({ pressed }) => [s.sellerAction, pressed && s.pressed]}
          >
            <SText variant="caption" style={s.username} numberOfLines={1}>
              @{item.username}
            </SText>
          </Pressable>
        ) : (
          <SText variant="caption" style={s.username} numberOfLines={1}>
            @{item.username}
          </SText>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette, isDark: boolean) {
  return StyleSheet.create({
    actionColumn: {
      alignItems: "flex-end",
      justifyContent: "center",
    },
    cardRow: {
      backgroundColor: colors.panelBg,
      borderCurve: "continuous",
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      elevation: 1,
      marginBottom: spacing.sm,
      minHeight: 122,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.08 : 0.04,
      shadowRadius: 8,
    },
    infoColumn: {
      flex: 1,
      gap: spacing.xxs,
      justifyContent: "center",
      minWidth: 0,
    },
    mainAction: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    mainRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
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
    price: {
      fontSize: 12,
      lineHeight: 17,
    },
    pressed: {
      opacity: 0.72,
    },
    rankColumn: {
      alignItems: "center",
      gap: spacing.xs,
      width: 34,
    },
    row: {
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    sellerName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
      minWidth: 0,
    },
    sellerAction: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: 44,
    },
    sellerRow: {
      minHeight: 44,
      justifyContent: "center",
    },
    thumbnailFallback: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      justifyContent: "center",
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
