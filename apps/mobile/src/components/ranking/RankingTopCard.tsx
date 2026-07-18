import { memo, useCallback, useMemo, useState } from "react";
import { Image, Pressable, useWindowDimensions, View } from "react-native";

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
import { formatCompactCount } from "../../features/ranking/types";
import { PriceText } from "../ui/PriceText";
import { SText } from "../ui/SText";
import { GroupBuyAlertButton } from "./FollowButton";
import { RankBadge } from "./RankBadge";
import { RankingTrendBadge } from "./RankingTrendBadge";
import { makeRankingTopStyles } from "./RankingTopThree.styles";

type RankingItemAction = (item: GroupBuyRankingItem) => void;

export interface RankingTopCardProps {
  item: RankingListItem;
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
  topScore?: number;
  variant: "hero" | "compact";
}

export const RankingTopCard = memo(function RankingTopCard({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
  topScore,
  variant,
}: RankingTopCardProps) {
  const theme = useCommerceTheme();
  const { shadow } = theme;
  const { fontScale } = useWindowDimensions();
  const s = useMemo(() => makeRankingTopStyles(theme), [theme]);
  const displayName = getDisplayName(item);
  const isHero = variant === "hero";
  const largeText = fontScale >= 1.3;
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
  const proof = `조회 ${formatCompactCount(item.metrics.deepViews)} · 저장 ${formatCompactCount(item.metrics.bookmarks)} · 알림 ${formatCompactCount(item.metrics.notifications)}`;
  const detailLabel = getRankingItemAccessibilityLabel({
    rank: item.rank,
    name: displayName,
    priceKrw: item.priceKrw,
    deadline,
    popularity,
    metrics: isHero ? item.metrics : undefined,
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
    <View
      style={[isHero ? s.heroCard : s.compactCard, shadow]}
      testID={isHero ? "ranking-top-hero" : `ranking-top-compact-${item.rank}`}
    >
      <Pressable
        accessibilityHint="공구 상세 보기"
        accessibilityLabel={detailLabel}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          isHero ? s.heroMainAction : s.compactMainAction,
          largeText && !isHero ? s.compactMainActionLargeText : null,
          pressed ? s.pressed : null,
        ]}
      >
        <View style={isHero ? s.heroMedia : s.compactMedia}>
          {imageSource && imageUrl !== failedImageUrl ? (
            <Image
              accessible={false}
              onError={handleImageError}
              resizeMode="cover"
              source={imageSource}
              style={s.productImage}
              testID={`ranking-top-image-${item.rank}`}
            />
          ) : (
            <View style={s.imageFallback}>
              <View style={s.imageFallbackMark}>
                <SText style={s.imageFallbackText} variant="caption">
                  {displayName.charAt(0)}
                </SText>
              </View>
              <SText style={s.imageFallbackLabel} variant="caption">
                상품 이미지 준비 중
              </SText>
            </View>
          )}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={s.rankOverlay}
          >
            <RankBadge rank={item.rank} />
            <RankingTrendBadge trend={item.trend} />
          </View>
          {isHero ? (
            <View style={s.heroPopularityOverlay}>
              <SText style={s.heroPopularityText} variant="caption">
                인기지수 {popularity.index}
              </SText>
            </View>
          ) : null}
        </View>

        <View style={isHero ? s.heroInfo : s.compactInfo}>
          <View style={s.signalRow}>
            {!isHero ? (
              <View style={s.popularityPill}>
                <SText style={s.popularityPillText} variant="caption">
                  인기지수 {popularity.index}
                </SText>
              </View>
            ) : null}
            <SText style={s.reasonText} variant="caption">
              {popularity.reason}
            </SText>
          </View>
          <SText
            numberOfLines={largeText ? undefined : 2}
            style={isHero ? s.heroName : s.compactName}
            testID={`ranking-top-name-${item.rank}`}
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
          {isHero ? (
            <SText
              numberOfLines={largeText ? undefined : 1}
              style={s.proofText}
              testID={`ranking-top-metrics-${item.rank}`}
              variant="caption"
            >
              {proof}
            </SText>
          ) : null}
        </View>
      </Pressable>

      <View style={[s.cardFooter, largeText ? s.cardFooterLargeText : null]}>
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
              testID={`ranking-top-seller-${item.rank}`}
              variant="caption"
            >
              @{item.username}
            </SText>
          </Pressable>
        ) : (
          <SText
            numberOfLines={largeText ? undefined : 1}
            style={s.username}
            testID={`ranking-top-seller-${item.rank}`}
            variant="caption"
          >
            @{item.username}
          </SText>
        )}
        <GroupBuyAlertButton
          groupBuyName={displayName}
          isEnabled={item.isNotifying ?? false}
          notificationState={item.notificationState}
          onPress={handleToggleAlert}
        />
      </View>
    </View>
  );
});

function getDisplayName(item: GroupBuyRankingItem) {
  return (item.productName ?? item.brandName ?? item.username) || "공구";
}
