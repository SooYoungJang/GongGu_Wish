import { StyleSheet, View } from 'react-native';

import { spacing } from '../../design/tokens';
import type { CategoryColorName } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';

import { CATEGORIES } from './CategoryRow';

export function categoryForIndex(index: number): CategoryColorName {
  return CATEGORIES[index % CATEGORIES.length].key;
}

export function categoryForGroupBuy(item: GroupBuy, index: number): CategoryColorName {
  return item.category ?? categoryForIndex(index);
}

type DealCardGridProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
};

export function DealCardGrid({ groupBuys, onPressDeal }: DealCardGridProps) {
  return (
    <View style={styles.dealGrid}>
      {groupBuys.map((item, index) => (
        <DealCard key={item.id} item={item} category={categoryForGroupBuy(item, index)} onPress={() => onPressDeal(item)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
});
