import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';
import { borderRadius, spacing, typography } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { categoryForGroupBuy } from './DealCardGrid';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';
import { isGroupBuyActiveOnDate } from '../../utils/groupBuyDates';

type ThisWeekDealsProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
  selectedDate: Date | null;
};

export function ThisWeekDeals({ groupBuys, onPressDeal, selectedDate }: ThisWeekDealsProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const thisWeekItems = useMemo(() => {
    const targetDate = selectedDate ?? new Date();
    return groupBuys.filter((item) => isGroupBuyActiveOnDate(item, targetDate));
  }, [groupBuys, selectedDate]);

  return (
    <View style={s.section}>
      {thisWeekItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {thisWeekItems.map((item, index) => (
            <View key={item.id} style={s.card}>
              <DealCard item={item} category={categoryForGroupBuy(item, index)} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.empty}>
          <SText variant="body" style={s.emptyText}>이번주 공구가 없습니다</SText>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    scroll: { gap: spacing.md, paddingRight: spacing.lg },
    card: { width: 120, minHeight: 160 },
    empty: {
      alignItems: 'center',
      padding: spacing.lg,
    },
    emptyText: { ...typography.body, textAlign: 'center' },
  });
}
