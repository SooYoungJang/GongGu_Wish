import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';
import { borderRadius, spacing, typography } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { categoryForIndex } from './DealCardGrid';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type ThisWeekDealsProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
  selectedDate: Date | null;
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

function isOnDate(endDate: string | null, date: Date): boolean {
  if (!endDate) return false;
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === date.getFullYear()
    && d.getMonth() === date.getMonth()
    && d.getDate() === date.getDate();
}

export function ThisWeekDeals({ groupBuys, onPressDeal, selectedDate }: ThisWeekDealsProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const thisWeekItems = useMemo(() => {
    if (selectedDate) {
      return groupBuys.filter((item) => isOnDate(item.endDate, selectedDate));
    }
    return groupBuys.filter((item) => isInThisWeek(item.endDate));
  }, [groupBuys, selectedDate]);

  const heading = selectedDate
    ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 공구`
    : '이번주 공구';

  const emptyText = selectedDate
    ? '선택한 날짜에 공구가 없습니다'
    : '이번주 공구가 없습니다';
  return (
    <View style={s.section}>
      <SText variant="cardTitle" style={s.heading}>{heading}</SText>
      {thisWeekItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {thisWeekItems.map((item, index) => (
            <View key={item.id} style={s.card}>
              <DealCard item={item} category={categoryForIndex(index)} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.empty}>
          <SText variant="body" style={s.emptyText}>{emptyText}</SText>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    heading: { marginBottom: spacing.md },
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
}
