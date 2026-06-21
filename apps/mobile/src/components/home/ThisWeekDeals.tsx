import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, typography } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { categoryForIndex } from './DealCardGrid';

type ThisWeekDealsProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
};

function isInThisWeek(endDate: string | null): boolean {
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const current = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - current);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return date >= monday && date <= sunday;
}

export function ThisWeekDeals({ groupBuys, onPressDeal }: ThisWeekDealsProps) {
  const thisWeekItems = useMemo(() => groupBuys.filter((item) => isInThisWeek(item.endDate)), [groupBuys]);
  return (
    <View style={styles.section}>
      {thisWeekItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {thisWeekItems.map((item, index) => (
            <View key={item.id} style={styles.card}>
              <DealCard item={item} category={categoryForIndex(index)} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>이번주 공구가 없습니다</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  scroll: { gap: spacing.md, paddingRight: spacing.lg },
  card: { width: 120, minHeight: 160 },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: { ...typography.body, textAlign: 'center' },
});
