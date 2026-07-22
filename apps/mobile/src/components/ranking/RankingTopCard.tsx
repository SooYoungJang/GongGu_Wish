import { memo, useCallback, useMemo, useState } from "react";
import { Image, Pressable, useWindowDimensions, View } from "react-native";

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
  variant: "hero" | "compact";
}

export const RankingTopCard = memo(function RankingTopCard({
  item,
  onPress,
  onPressSeller,
  onToggleAlert,
  variant,
}: RankingTopCardProps) {
  const theme = useCommerceTheme();
  const { shadow } = theme;
  const { fontScale } = useWindowDimensions();
  const s = useMemo(() => makeRankingTopStyles(theme), [theme]);
  const instagramHandle = formatInstagramHandle(item.username);
  const displayName = getDisplayName(item, instagramHandle);
  const isHero = variant === "hero";
  const largeText = fontScale >= 1.3;
  const imageUrl = item.thumbnailUrl ?? item.mediaUrls[0] ?? null;
  const imageSource = useMemo(
    () => (imageUrl ? { uri: imageUrl } : null),
    [imageUrl],
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const deadline = formatRankingDeadline(item.endDate);
  const detailLabel = getRankingItemAccessibilityLabel({
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
        </View>

        <View style={isHero ? s.heroInfo : s.compactInfo}>
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
        </View>
      </Pressable>

      <View style={[s.cardFooter, largeText ? s.cardFooterLargeText : null]}>
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
              <SText
                numberOfLines={largeText ? undefined : 1}
                style={s.username}
                testID={`ranking-top-seller-${item.rank}`}
                variant="caption"
              >
                {instagramHandle}
              </SText>
            </Pressable>
          ) : (
            <SText
              numberOfLines={largeText ? undefined : 1}
              style={s.username}
              testID={`ranking-top-seller-${item.rank}`}
              variant="caption"
            >
              {instagramHandle}
            </SText>
          )
        ) : null}
        <View style={s.alertAction}>
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

function getDisplayName(
  item: GroupBuyRankingItem,
  instagramHandle: string | null,
) {
  return (item.productName ?? item.brandName ?? instagramHandle) || "공구";
}
