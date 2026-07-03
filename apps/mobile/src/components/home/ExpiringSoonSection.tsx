import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';

import { borderRadius, spacing, typography } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { categoryForGroupBuy } from './DealCardGrid';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

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
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

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
    <View style={s.section}>
      <View style={s.header}>
        <SText variant="cardTitle" style={s.title}>마감임박 공구</SText>
        <Pressable
          accessibilityLabel="마감임박 공구 전체보기"
          accessibilityRole="button"
          style={s.viewAllBtn}
        >
          <SText variant="cardBrand">전체보기</SText>
        </Pressable>
      </View>
      {expiringItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {expiringItems.map((item, index) => (
            <View key={item.id} style={s.card}>
              <DealCard item={item} category={categoryForGroupBuy(item, index)} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.empty}>
          <SText variant="body" style={s.emptyText}>마감임박 공구가 없습니다</SText>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    viewAllBtn: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: 'transparent',
      borderWidth: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.xs,
    },
    scroll: { gap: spacing.md, paddingRight: spacing.lg },
    card: { width: 120, minHeight: 120 },
    empty: {
      alignItems: 'center',
      padding: spacing.lg,
    },
    emptyText: { ...typography.body, textAlign: 'center' },
  });
}
