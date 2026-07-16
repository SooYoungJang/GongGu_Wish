import { useMemo } from "react";
import { View } from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
} from "../../features/ranking/types";
import { SText } from "../ui/SText";
import { RankingTopCard } from "./RankingTopCard";
import { makeRankingTopStyles } from "./RankingTopThree.styles";

type RankingItemAction = (...args: [GroupBuyRankingItem]) => void;

export interface RankingTopThreeProps {
  items: readonly RankingListItem[];
  onPress: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert: RankingItemAction;
}

export function RankingTopThree({
  items,
  onPress,
  onPressSeller,
  onToggleAlert,
}: RankingTopThreeProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeRankingTopStyles(colors), [colors]);
  const topItems = items
    .filter((item) => item.rank >= 1 && item.rank <= 3)
    .sort((left, right) => left.rank - right.rank);

  if (topItems.length === 0) return null;

  const [hero, ...compact] = topItems;

  return (
    <View
      accessibilityLabel="랭킹 상위 3위"
      accessibilityRole="header"
      style={s.container}
      testID="ranking-top-three"
    >
      <SText variant="cardTitle" style={s.sectionTitle}>
        상위 3위
      </SText>
      <RankingTopCard
        item={hero}
        onPress={onPress}
        onPressSeller={onPressSeller}
        onToggleAlert={onToggleAlert}
        variant="hero"
      />
      {compact.length > 0 ? (
        <View style={s.compactGrid}>
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
}
