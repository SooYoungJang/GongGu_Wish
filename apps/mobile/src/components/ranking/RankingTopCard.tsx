import { useMemo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
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
import { ThumbnailStrip } from "./ThumbnailStrip";
import { makeRankingTopStyles } from "./RankingTopThree.styles";

type RankingItemAction = (...args: [GroupBuyRankingItem]) => void;

export interface RankingTopCardProps {
  item: RankingListItem;
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
  variant: "hero" | "compact";
}

export function RankingTopCard({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
  variant,
}: RankingTopCardProps) {
  const { colors, isDark } = useCommerceTheme();
  const { fontScale, width } = useWindowDimensions();
  const s = useMemo(
    () => makeRankingTopStyles(colors, isDark),
    [colors, isDark],
  );
  const displayName = getDisplayName(item);
  const isHero = variant === "hero";
  const largeText = fontScale >= 1.3;
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
  const thumbnailSize = isHero ? Math.min(Math.max(width * 0.3, 104), 132) : 80;
  const detailLabel = `${item.rank}위 ${displayName} 상세 보기`;

  return (
    <View
      style={isHero ? s.heroCard : s.compactCard}
      testID={isHero ? "ranking-top-hero" : `ranking-top-compact-${item.rank}`}
    >
      <Pressable
        accessibilityHint="공구 상세 보기"
        accessibilityLabel={detailLabel}
        accessibilityRole="button"
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          isHero ? s.heroMainAction : s.compactMainAction,
          largeText && isHero && s.heroMainActionLargeText,
          pressed && s.pressed,
        ]}
      >
        <View style={isHero ? s.heroMediaColumn : s.compactMediaColumn}>
          <RankBadge rank={item.rank} />
          <RankingTrendBadge trend={item.trend} />
          {thumbnails.length > 0 ? (
            <ThumbnailStrip
              maxVisible={1}
              size={thumbnailSize}
              thumbnails={thumbnails}
            />
          ) : (
            <View
              style={[
                isHero ? s.heroThumbnailFallback : s.compactThumbnailFallback,
                { height: thumbnailSize, width: thumbnailSize },
              ]}
            >
              <SText variant="caption" style={s.thumbnailFallbackText}>
                {displayName.charAt(0)}
              </SText>
            </View>
          )}
        </View>
        <View style={isHero ? s.heroInfoColumn : s.compactInfoColumn}>
          <SText
            numberOfLines={largeText ? undefined : 2}
            style={isHero ? s.heroName : s.compactName}
            testID={`ranking-top-name-${item.rank}`}
            variant="body"
          >
            {displayName}
          </SText>
          <PriceText
            numberOfLines={largeText ? 2 : 1}
            priceKrw={item.priceKrw}
            style={s.price}
          />
          <SText
            numberOfLines={largeText ? undefined : 2}
            style={s.metricText}
            testID={`ranking-top-metrics-${item.rank}`}
            variant="caption"
          >
            조회 {formatCompactCount(item.metrics.deepViews)} · 저장{" "}
            {formatCompactCount(item.metrics.bookmarks)} · 알림{" "}
            {formatCompactCount(item.metrics.notifications)}
          </SText>
          <SText style={s.popularityText} variant="caption">
            인기지수 {Math.round(item.metrics.score)}
          </SText>
        </View>
      </Pressable>
      <View style={s.sellerRow}>
        {onPressSeller ? (
          <Pressable
            accessibilityHint="판매자의 공구 목록 보기"
            accessibilityLabel={`@${item.username} 판매자 공구 보기`}
            accessibilityRole="button"
            onPress={() => onPressSeller(item)}
            style={({ pressed }) => [s.sellerAction, pressed && s.pressed]}
          >
            <SText
              numberOfLines={largeText ? 2 : 1}
              style={s.username}
              variant="caption"
            >
              @{item.username}
            </SText>
          </Pressable>
        ) : (
          <SText
            numberOfLines={largeText ? 2 : 1}
            style={s.username}
            variant="caption"
          >
            @{item.username}
          </SText>
        )}
      </View>
      <View
        style={[
          isHero ? s.heroFooter : s.compactFooter,
          largeText &&
            (isHero ? s.heroFooterLargeText : s.compactFooterLargeText),
        ]}
      >
        <SText style={s.detailHint} variant="caption">
          공구 상세에서 더 보기
        </SText>
        <GroupBuyAlertButton
          groupBuyName={displayName}
          isEnabled={item.isNotifying ?? false}
          notificationState={item.notificationState}
          onPress={() => onToggleAlert(item)}
        />
      </View>
    </View>
  );
}

function getDisplayName(item: GroupBuyRankingItem) {
  return (item.productName ?? item.brandName ?? item.username) || "공구";
}
