import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, typography } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { categoryForIndex } from './DealCardGrid';

type ExpiringSoonSectionProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
};

function isExpiringSoon(endDate: string | null): boolean {
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = date.getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 7 * 86_400_000;
}

export function ExpiringSoonSection({ groupBuys, onPressDeal }: ExpiringSoonSectionProps) {
  const expiringItems = useMemo(
    () =>
      groupBuys
        .filter((item) => isExpiringSoon(item.endDate))
        .sort((a, b) => {
          const aDate = new Date(a.endDate ?? 0).getTime();
          const bDate = new Date(b.endDate ?? 0).getTime();
          return aDate - bDate;
        }),
    [groupBuys],
  );
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>마감임박 공구</Text>
        <Text style={styles.action}>전체보기</Text>
      </View>
      {expiringItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {expiringItems.map((item, index) => (
            <View key={item.id} style={styles.card}>
              <DealCard item={item} category={categoryForIndex(index)} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>마감임박 공구가 없습니다</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  action: { color: colors.textLink, fontSize: 13, fontWeight: '700' },
  scroll: { gap: spacing.md, paddingRight: spacing.lg },
  card: { width: 120, minHeight: 120 },
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
