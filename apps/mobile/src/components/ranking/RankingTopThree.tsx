import { memo, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
} from "../../features/ranking/types";
import { SText } from "../ui/SText";
import { RankingTopCard } from "./RankingTopCard";
import { makeRankingTopStyles } from "./RankingTopThree.styles";

type RankingItemAction = (item: GroupBuyRankingItem) => void;

export interface RankingTopThreeProps {
  items: readonly RankingListItem[];
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
}

export const RankingTopThree = memo(function RankingTopThree({
  items,
  onPress,
  onPressSeller,
  onToggleAlert,
}: RankingTopThreeProps) {
  const theme = useCommerceTheme();
  const { fontScale, width } = useWindowDimensions();
  const s = useMemo(() => makeRankingTopStyles(theme), [theme]);
  const largeText = fontScale >= 1.3;
  const stackCompact = largeText || width <= 340;
  const topItems = items.filter((item) => item.rank >= 1 && item.rank <= 3);

  if (topItems.length === 0) return null;

  const hero = topItems.find((item) => item.rank === 1);
  const compact = topItems.filter(
    (item) => item.rank === 2 || item.rank === 3,
  );
  return (
    <View
      style={s.container}
      testID="ranking-top-three"
    >
      <View style={s.titleBlock}>
        <SText
          accessibilityRole="header"
          variant="cardTitle"
          style={s.sectionTitle}
        >
          지금 가장 인기 있는 공구
        </SText>
        <SText variant="caption" style={s.sectionSubtitle}>
          순위 등락으로 달라진 관심을 확인해보세요
        </SText>
      </View>
      {hero ? (
        <RankingTopCard
          item={hero}
          onPress={onPress}
          onPressSeller={onPressSeller}
          onToggleAlert={onToggleAlert}
          variant="hero"
        />
      ) : null}
      {compact.length > 0 ? (
        <View
          style={[s.compactGrid, stackCompact && s.compactGridLargeText]}
          testID="ranking-top-compact-grid"
        >
          {compact.map((item) => (
            <RankingTopCard
              key={item.groupBuyId}
              item={item}
              onPress={onPress}
              onPressSeller={onPressSeller}
              onToggleAlert={onToggleAlert}
              variant="compact"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});
