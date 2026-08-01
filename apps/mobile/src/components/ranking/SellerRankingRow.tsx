import { memo, useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";
import {
  formatRankingDeadline,
  getRankingItemAccessibilityLabel,
} from "../../features/ranking/popularityPresentation";
import type {
  GroupBuyRankingItem,
  RankingListItem,
} from "../../features/ranking/types";
import { InstagramIdentity } from "../ui/InstagramIdentity";
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
}

export const SellerRankingRow = memo(function SellerRankingRow({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
}: SellerRankingRowProps) {
  const theme = useCommerceTheme();
  const { shadow } = theme;
  const { fontScale, width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const compact = width <= 360;
  const largeText = fontScale >= 1.3;
  const instagramHandle = formatInstagramHandle(item.username);
  const displayName =
    (item.productName ?? item.brandName ?? instagramHandle) || "공구";
  const imageUrl = item.thumbnailUrl ?? item.mediaUrls[0] ?? null;
  const imageSource = useMemo(
    () => (imageUrl ? { uri: imageUrl } : null),
    [imageUrl],
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const deadline = formatRankingDeadline(item.endDate);
  const accessibilityLabel = getRankingItemAccessibilityLabel({
    rank: item.rank,
    name: displayName,
    priceKrw: item.priceKrw,
    deadline,
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
            testID={`ranking-row-rank-column-${item.rank}`}
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

          <View style={s.infoColumn} testID={`ranking-row-info-${item.rank}`}>
            <SText
              numberOfLines={largeText ? undefined : 2}
              style={s.sellerName}
              testID={`ranking-row-name-${item.rank}`}
              variant="body"
            >
              {displayName}
            </SText>
            <View
              style={s.commerceRow}
              testID={`ranking-row-commerce-${item.rank}`}
            >
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
      </View>

      <View
        style={[s.footer, largeText ? s.footerLargeText : null]}
        testID={`ranking-row-footer-${item.rank}`}
      >
        {instagramHandle ? (
          onPressSeller ? (
            <Pressable
              accessibilityHint="판매자의 공구 목록 보기"
              accessibilityLabel={`${instagramHandle} 판매자 공구 보기`}
              accessibilityRole="button"
              onPress={handlePressSeller}
              style={({ pressed }) => [
                s.sellerAction,
                pressed ? s.pressed : null,
              ]}
            >
              <InstagramIdentity
                allowWrapping={largeText}
                iconTestID={`ranking-row-seller-icon-${item.rank}`}
                size="body"
                style={s.sellerIdentity}
                testID={`ranking-row-seller-${item.rank}`}
                textStyle={s.username}
                username={item.username}
              />
              <Ionicons
                accessible={false}
                color={theme.colors.weak}
                name="chevron-forward"
                size={16}
              />
            </Pressable>
          ) : (
            <View style={s.sellerStatic}>
              <InstagramIdentity
                allowWrapping={largeText}
                iconTestID={`ranking-row-seller-icon-${item.rank}`}
                size="body"
                style={s.sellerIdentity}
                testID={`ranking-row-seller-${item.rank}`}
                textStyle={s.username}
                username={item.username}
              />
            </View>
          )
        ) : (
          <View style={s.footerSpacer} />
        )}

        <View style={s.actionColumn}>
          <GroupBuyAlertButton
            groupBuyName={displayName}
            isEnabled={item.isNotifying ?? false}
            notificationState={item.notificationState}
            onPress={handleToggleAlert}
          />
        </View>
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
    cardRow: {
      backgroundColor: colors.bg,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.md,
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
    footer: {
      alignItems: "center",
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      minHeight: 52,
    },
    footerLargeText: {
      alignItems: "flex-end",
    },
    footerSpacer: {
      flex: 1,
    },
    media: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderCurve: "continuous",
      borderRadius: radius.lg,
      height: 76,
      justifyContent: "center",
      overflow: "hidden",
      width: 76,
    },
    mediaCompact: {
      height: 68,
      width: 68,
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
      flexShrink: 0,
      gap: spacing.xs,
      minWidth: 34,
    },
    sellerAction: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 44,
      minWidth: 0,
      paddingHorizontal: spacing.xs,
    },
    sellerIdentity: {
      flex: 1,
    },
    sellerStatic: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      minHeight: 44,
      minWidth: 0,
      paddingHorizontal: spacing.xs,
    },
    sellerName: {
      color: colors.text,
      ...typography.bodyStrong,
      minWidth: 0,
    },
    thumbnailFallbackText: {
      color: colors.muted,
      fontSize: 18,
      fontWeight: "900",
    },
    username: {
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
  });
}
