import { memo, useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import {
  formatRankingDeadline,
  getRankingItemAccessibilityLabel,
  getPopularityPresentation,
} from "../../features/ranking/popularityPresentation";
import type {
  GroupBuyRankingItem,
  RankingListItem,
} from "../../features/ranking/types";
import { PriceText } from "../ui/PriceText";
import { SText } from "../ui/SText";
import { GroupBuyAlertButton } from "./FollowButton";
import { RankBadge } from "./RankBadge";
import { RankingTrendBadge } from "./RankingTrendBadge";

type RankingItemAction = (item: GroupBuyRankingItem) => void;

export interface SellerRankingRowProps {
  item: RankingListItem;
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
  topScore?: number;
}

export const SellerRankingRow = memo(function SellerRankingRow({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
  topScore,
}: SellerRankingRowProps) {
  const theme = useCommerceTheme();
  const { shadow } = theme;
  const { fontScale, width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const compact = width <= 360;
  const largeText = fontScale >= 1.3;
  const displayName =
    (item.productName ?? item.brandName ?? item.username) || "공구";
  const imageUrl = item.thumbnailUrl ?? item.mediaUrls[0] ?? null;
  const imageSource = useMemo(
    () => (imageUrl ? { uri: imageUrl } : null),
    [imageUrl],
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const popularity = getPopularityPresentation(
    item.metrics,
    topScore ?? item.metrics.score,
  );
  const deadline = formatRankingDeadline(item.endDate);
  const accessibilityLabel = getRankingItemAccessibilityLabel({
    rank: item.rank,
    name: displayName,
    priceKrw: item.priceKrw,
    deadline,
    popularity,
  });

  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handlePressSeller = useCallback(
    () => onPressSeller?.(item),
    [item, onPressSeller],
  );
  const handleToggleAlert = useCallback(
    () => onToggleAlert(item),
    [item, onToggleAlert],
  );
  const handleImageError = useCallback(() => {
    if (imageUrl) setFailedImageUrl(imageUrl);
  }, [imageUrl]);

  return (
    <View testID={`ranking-row-${item.rank}`} style={[s.cardRow, shadow]}>
      <View
        style={[s.mainRow, largeText ? s.mainRowLargeText : null]}
        testID={`ranking-row-main-${item.rank}`}
      >
        <Pressable
          accessibilityHint="공구 상세 보기"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={handlePress}
          style={({ pressed }) => [
            s.mainAction,
            largeText ? s.mainActionLargeText : null,
            pressed ? s.pressed : null,
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={s.rankColumn}
          >
            <RankBadge rank={item.rank} />
            <RankingTrendBadge trend={item.trend} />
          </View>

          <View style={[s.media, compact ? s.mediaCompact : null]}>
            {imageSource && imageUrl !== failedImageUrl ? (
              <Image
                accessible={false}
                onError={handleImageError}
                resizeMode="cover"
                source={imageSource}
                style={s.image}
                testID={`ranking-row-image-${item.rank}`}
              />
            ) : (
              <SText style={s.thumbnailFallbackText} variant="caption">
                {displayName.charAt(0)}
              </SText>
            )}
          </View>

          <View style={s.infoColumn}>
            <SText
              numberOfLines={largeText ? undefined : 1}
              style={s.signalText}
              testID={`ranking-row-signal-${item.rank}`}
              variant="caption"
            >
              인기지수 {popularity.index} · {popularity.reason}
            </SText>
            <SText
              numberOfLines={largeText ? undefined : 2}
              style={s.sellerName}
              testID={`ranking-row-name-${item.rank}`}
              variant="body"
            >
              {displayName}
            </SText>
            <View style={s.commerceRow}>
              <PriceText
                numberOfLines={largeText ? 2 : 1}
                priceKrw={item.priceKrw}
                style={s.price}
              />
              <SText style={s.deadline} variant="caption">
                {deadline}
              </SText>
            </View>
          </View>
        </Pressable>

        <View style={[s.actionColumn, largeText ? s.actionColumnLargeText : null]}>
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
            onPress={handlePressSeller}
            style={({ pressed }) => [
              s.sellerAction,
              pressed ? s.pressed : null,
            ]}
          >
            <SText
              numberOfLines={largeText ? undefined : 1}
              style={s.username}
              testID={`ranking-row-seller-${item.rank}`}
              variant="caption"
            >
              @{item.username}
            </SText>
          </Pressable>
        ) : (
          <SText
            numberOfLines={largeText ? undefined : 1}
            style={s.username}
            testID={`ranking-row-seller-${item.rank}`}
            variant="caption"
          >
            @{item.username}
          </SText>
        )}
      </View>
    </View>
  );
});

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    actionColumn: {
      alignItems: "flex-end",
      justifyContent: "center",
    },
    actionColumnLargeText: {
      alignSelf: "flex-end",
    },
    cardRow: {
      backgroundColor: colors.panelBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.xs,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    commerceRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    deadline: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 16,
    },
    image: {
      height: "100%",
      width: "100%",
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
    mainActionLargeText: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
    mainRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    mainRowLargeText: {
      alignItems: "stretch",
      flexDirection: "column",
    },
    media: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: radius.md,
      borderWidth: 1,
      height: 80,
      justifyContent: "center",
      overflow: "hidden",
      width: 64,
    },
    mediaCompact: {
      height: 72,
      width: 56,
    },
    pressed: {
      opacity: 0.72,
    },
    price: {
      fontSize: 12,
      lineHeight: 17,
    },
    rankColumn: {
      alignItems: "center",
      gap: spacing.xs,
      width: 34,
    },
    sellerAction: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.xs,
    },
    sellerName: {
      color: colors.text,
      ...typography.bodyStrong,
      minWidth: 0,
    },
    sellerRow: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      justifyContent: "center",
      minHeight: 44,
    },
    signalText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 16,
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
