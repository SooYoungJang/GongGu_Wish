import { memo, type Dispatch, useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import type { ColorPalette } from '../../context/ThemeContext';
import { useTheme } from '../../context/ThemeContext';
import { commerceRadius } from '../../design/commerce';
import { spacing } from '../../design/tokens';
import type { CategoryColorName } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { DealCard } from '../DealCard';
import { SText } from '../ui/SText';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const CALENDAR_CARD_WIDTH = 156;
export const CALENDAR_CARD_HEIGHT = 256;
export const CALENDAR_DATE_SECTION_HEIGHT = 312;

export type CalendarLayoutMetrics = {
  cardHeight: number;
  dateRailWidth: number;
  largeText: boolean;
  sectionHeight: number;
};

export function getCalendarLayoutMetrics(
  fontScale = 1,
): CalendarLayoutMetrics {
  const normalizedFontScale = Number.isFinite(fontScale)
    ? Math.min(2, Math.max(1, fontScale))
    : 1;
  const scaleDelta = normalizedFontScale - 1;
  const cardHeight = CALENDAR_CARD_HEIGHT + Math.round(scaleDelta * 128);

  return {
    cardHeight,
    dateRailWidth: 58 + Math.round(scaleDelta * 22),
    largeText: normalizedFontScale >= 1.3,
    sectionHeight:
      cardHeight + 56 + Math.round(scaleDelta * 32),
  };
}

export type CalendarDateGroup = {
  date: Date;
  dateKey: string;
  items: GroupBuy[];
};

export function getCalendarDateGroupLayout(
  _: ArrayLike<CalendarDateGroup> | null | undefined,
  index: number,
  sectionHeight = CALENDAR_DATE_SECTION_HEIGHT,
) {
  return {
    index,
    length: sectionHeight,
    offset: sectionHeight * index,
  };
}

export function calendarDateGroupKey(item: CalendarDateGroup) {
  return item.dateKey;
}

function categoryForIndex(index: number): CategoryColorName {
  const keys: CategoryColorName[] = [
    'food',
    'living',
    'beauty',
    'fashion',
    'home',
    'kitchen',
    'electronics',
    'pet',
    'auto',
    'hobby',
    'baby',
    'sports',
    'stationery',
    'books',
    'media',
    'travel',
  ];
  return keys[index % keys.length];
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

const CalendarDealCard = memo(function CalendarDealCard({
  index,
  item,
  layoutMetrics,
  onPress,
}: {
  index: number;
  item: GroupBuy;
  layoutMetrics: CalendarLayoutMetrics;
  onPress: Dispatch<GroupBuy>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, layoutMetrics),
    [colors, layoutMetrics],
  );
  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <View style={styles.calendarDealCard}>
      <DealCard
        category={item.category ?? categoryForIndex(index)}
        item={item}
        onPress={handlePress}
      />
    </View>
  );
});

export const CalendarDateRow = memo(function CalendarDateRow({
  date,
  dateKey,
  filterLabel,
  isSelected,
  items,
  layoutMetrics,
  onDealPress,
}: CalendarDateGroup & {
  filterLabel: string | null;
  isSelected: boolean;
  layoutMetrics: CalendarLayoutMetrics;
  onDealPress: Dispatch<GroupBuy>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, layoutMetrics),
    [colors, layoutMetrics],
  );
  const weekday = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  const renderDeal = useCallback(
    ({ item, index }: { item: GroupBuy; index: number }) => (
      <CalendarDealCard
        index={index}
        item={item}
        layoutMetrics={layoutMetrics}
        onPress={onDealPress}
      />
    ),
    [layoutMetrics, onDealPress],
  );
  const keyExtractor = useCallback((item: GroupBuy) => item.id, []);

  return (
    <View
      style={[styles.dateSection, isSelected && styles.dateSectionSelected]}
      testID={`calendar-date-row-${dateKey}`}
    >
      <View style={styles.dateRail}>
        <SText variant="caption" style={styles.dateRailMonth}>
          {date.getMonth() + 1}월
        </SText>
        <SText variant="cardTitle" style={styles.dateRailDay}>
          {date.getDate()}일
        </SText>
        <SText variant="caption" style={styles.dateRailWeekday}>
          {weekday}
        </SText>
        <View style={styles.dateRailLine} />
      </View>

      <View style={styles.dateSectionContent}>
        <View
          style={[
            styles.dateSectionHeader,
            layoutMetrics.largeText && styles.dateSectionHeaderLarge,
          ]}
        >
          <SText variant="subtitle" style={styles.dateSectionTitle}>
            {isToday(date) ? '오늘의 공구' : '진행 공구'}
          </SText>
          <SText variant="label">
            {filterLabel
              ? `${items.length}개 · ${filterLabel}`
              : `${items.length}개`}
          </SText>
        </View>

        {items.length > 0 ? (
          <FlatList
            contentContainerStyle={styles.dealsCarouselContent}
            data={items}
            getItemLayout={(_, index) => ({
              index,
              length: CALENDAR_CARD_WIDTH + spacing.md,
              offset: (CALENDAR_CARD_WIDTH + spacing.md) * index,
            })}
            horizontal
            keyExtractor={keyExtractor}
            renderItem={renderDeal}
            showsHorizontalScrollIndicator={false}
            style={styles.dealsCarousel}
            testID={`calendar-deals-carousel-${dateKey}`}
          />
        ) : (
          <View style={styles.emptyDateSection}>
            <SText variant="subtitle" style={styles.emptyDateTitle}>
              {filterLabel
                ? '선택한 필터의 공구가 없어요'
                : '이 날짜의 공구가 없어요'}
            </SText>
            <SText variant="caption">
              {filterLabel
                ? '필터를 바꾸거나 다른 날짜를 선택해보세요.'
                : '달력에서 다른 날짜를 선택해보세요.'}
            </SText>
          </View>
        )}
      </View>
    </View>
  );
});

function makeStyles(
  colors: ColorPalette,
  layoutMetrics: CalendarLayoutMetrics,
) {
  return StyleSheet.create({
    dateSection: {
      alignItems: 'center',
      borderBottomColor: colors.borderLight,
      borderBottomWidth: 1,
      flexDirection: 'row',
      height: layoutMetrics.sectionHeight,
      paddingVertical: spacing.sm,
    },
    dateSectionSelected: {
      backgroundColor: colors.softBg,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.lg,
    },
    dateRail: {
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingTop: spacing.sm,
      position: 'relative',
      width: layoutMetrics.dateRailWidth,
    },
    dateRailMonth: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    dateRailDay: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '900',
      marginTop: 1,
    },
    dateRailWeekday: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    dateRailLine: {
      backgroundColor: colors.border,
      bottom: 0,
      position: 'absolute',
      right: 0,
      top: spacing.xs,
      width: 1,
    },
    dateSectionContent: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
      paddingLeft: spacing.md,
    },
    dateSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 28,
      paddingRight: spacing.sm,
    },
    dateSectionHeaderLarge: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
    dateSectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 0,
    },
    dealsCarousel: {
      flexGrow: 0,
      height: layoutMetrics.cardHeight,
    },
    dealsCarouselContent: {
      paddingRight: spacing.lg,
    },
    calendarDealCard: {
      height: layoutMetrics.cardHeight,
      marginRight: spacing.md,
      width: CALENDAR_CARD_WIDTH,
    },
    emptyDateSection: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      height: layoutMetrics.cardHeight,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyDateTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
  });
}
