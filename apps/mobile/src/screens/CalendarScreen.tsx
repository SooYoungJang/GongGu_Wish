import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { DealCard } from '../components/DealCard';
import { borderRadius, colors, shadows, spacing } from '../design/tokens';
import type { CategoryColorName } from '../design/tokens';
import type { CalendarScreenProps, GroupBuy } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const DAY_CELL_SIZE = 44;
const DOT_SIZE = 5;
const SWIPE_THRESHOLD = 50;

// Temp followed usernames — replace with real following state hook when available
const FOLLOWED_USERNAMES = new Set(['sample_influencer', 'mom_blogger', 'fitness_influencer']);

// ─── Date utilities ──────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function getMonthGrid(
  year: number,
  month: number,
): Array<Array<{ day: number; isCurrentMonth: boolean; date: Date }>> {
  const weeks: Array<Array<{ day: number; isCurrentMonth: boolean; date: Date }>> = [];
  const firstDay = new Date(year, month, 1);
  // getDay(): 0=Sun → convert to Mon=0-based
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let currentWeek: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

  // Trailing days from previous month
  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrevMonth - startOffset + i + 1;
    currentWeek.push({
      day,
      isCurrentMonth: false,
      date: new Date(year, month - 1, day),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push({
      day: d,
      isCurrentMonth: true,
      date: new Date(year, month, d),
    });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Leading days from next month
  if (currentWeek.length > 0) {
    for (let i = 1; currentWeek.length < 7; i++) {
      currentWeek.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function groupGroupBuysByDate(items: GroupBuy[]): Map<string, GroupBuy[]> {
  const map = new Map<string, GroupBuy[]>();
  for (const item of items) {
    if (!item.endDate) continue;
    const key = item.endDate.slice(0, 10);
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function categoryForIndex(index: number): CategoryColorName {
  const keys: CategoryColorName[] = ['beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital'];
  return keys[index % keys.length];
}

// ─── Calendar Grid Sub-components ───────────────────────────────────────────

function CalendarHeader({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  showFollowedOnly,
  onToggleFilter,
}: {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  showFollowedOnly: boolean;
  onToggleFilter: () => void;
}) {
  const label = `${year}년 ${month + 1}월`;
  return (
    <View style={styles.headerRow}>
      {/* Left: 오늘 button */}
      <Pressable
        accessibilityLabel="오늘로 이동"
        accessibilityRole="button"
        onPress={onToday}
        style={styles.todayButton}
      >
        <Text style={styles.todayButtonText}>오늘</Text>
      </Pressable>

      {/* Center: navigation arrows + title */}
      <View style={styles.headerNavGroup}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={onPrevMonth}
          style={styles.navArrow}
        >
          <Text style={styles.navArrowText}>◀</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{label}</Text>
        <Pressable
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          onPress={onNextMonth}
          style={styles.navArrow}
        >
          <Text style={styles.navArrowText}>▶</Text>
        </Pressable>
      </View>

      {/* Right: filter chip integrated into headerRow */}
      <Pressable
        accessibilityLabel={`팔로잉만 보기 ${showFollowedOnly ? '활성화' : '비활성화'}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: showFollowedOnly }}
        onPress={onToggleFilter}
        style={[
          styles.filterChip,
          {
            backgroundColor: showFollowedOnly ? colors.primary : 'transparent',
            borderColor: showFollowedOnly ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: showFollowedOnly ? colors.textInverse : colors.textSecondary },
          ]}
        >
          {showFollowedOnly ? '✓ 팔로잉' : '팔로잉만 보기'}
        </Text>
      </Pressable>
    </View>
  );
}

function WeekdayHeader() {
  return (
    <View style={styles.weekdayRow}>
      {WEEKDAY_LABELS.map((label) => (
        <View key={label} style={styles.weekdayCell}>
          <Text style={[styles.weekdayText, (label === '토' || label === '일') && styles.weekendText]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  isCurrentMonth,
  date,
  hasGroupBuys,
  isSelected,
  isTodayDate,
  onSelect,
}: {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
  hasGroupBuys: boolean;
  isSelected: boolean;
  isTodayDate: boolean;
  onSelect: (date: Date) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${day}일${isTodayDate ? ' (오늘)' : ''}`}
      accessibilityRole="button"
      onPress={() => onSelect(date)}
      style={[
        styles.dayCell,
        !isCurrentMonth && styles.dayCellOtherMonth,
        isTodayDate && styles.dayCellToday,
        isSelected && styles.dayCellSelected,
      ]}
    >
      <Text
        style={[
          styles.dayText,
          !isCurrentMonth && styles.dayTextOtherMonth,
          isTodayDate && !isSelected && styles.dayTextToday,
          isSelected && styles.dayTextSelected,
        ]}
      >
        {day}
      </Text>
      {hasGroupBuys ? (
        <View
          style={[
            styles.dot,
            isSelected && styles.dotSelected,
          ]}
        />
      ) : (
        <View style={styles.dotSpacer} />
      )}
    </Pressable>
  );
}

// ─── Main CalendarScreen ────────────────────────────────────────────────────

export function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initialParam = route.params?.initialDate;
  const initialDate = initialParam ? new Date(initialParam) : new Date();

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  const today = useMemo(() => new Date(), []);

  // Data fetching
  const { data, isFetching, isError } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const groupBuys = data?.length ? data : fallbackGroupBuys;

  // All group buys by date — for dot indicators (unaffected by filter)
  const allGroupBuysByDate = useMemo(() => groupGroupBuysByDate(groupBuys), [groupBuys]);
  const allDateKeysWithBuys = useMemo(() => {
    const set = new Set<string>();
    for (const [key] of allGroupBuysByDate) {
      set.add(key);
    }
    return set;
  }, [allGroupBuysByDate]);

  // Filter by followed influencers when toggle is ON
  const filteredGroupBuys = useMemo(
    () => (showFollowedOnly ? groupBuys.filter((gb) => FOLLOWED_USERNAMES.has(gb.rawPost.influencer.instagramUsername)) : groupBuys),
    [groupBuys, showFollowedOnly],
  );

  const groupBuysByDate = useMemo(() => groupGroupBuysByDate(filteredGroupBuys), [filteredGroupBuys]);
  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const selectedDateGroupBuys = useMemo(
    () => groupBuysByDate.get(selectedDateKey) ?? [],
    [groupBuysByDate, selectedDateKey],
  );
  const grid = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Reset filter state on screen re-entry
  useEffect(() => {
    setShowFollowedOnly(false);
  }, [route.key]);

  // Navigation helpers
  const goToPrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(now);
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    // If the selected date is in a different month, navigate to that month
    if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
      setCurrentYear(date.getFullYear());
      setCurrentMonth(date.getMonth());
    }
  }, [currentMonth, currentYear]);

  // Swipe gesture for month navigation
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          goToPrevMonth();
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          goToNextMonth();
        }
      },
    }),
  ).current;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top: Header with navigation + filter integrated */}
        <CalendarHeader
          year={currentYear}
          month={currentMonth}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
          showFollowedOnly={showFollowedOnly}
          onToggleFilter={() => setShowFollowedOnly((v) => !v)}
        />

        {/* Middle: Calendar grid with swipe */}
        <View {...panResponder.panHandlers} style={styles.calendarWrapper}>
          <WeekdayHeader />
          <View style={styles.gridContainer}>
            {grid.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((cell) => (
                  <DayCell
                    key={formatDateKey(cell.date)}
                    day={cell.day}
                    isCurrentMonth={cell.isCurrentMonth}
                    date={cell.date}
                    hasGroupBuys={allDateKeysWithBuys.has(formatDateKey(cell.date))}
                    isSelected={isSameDay(cell.date, selectedDate)}
                    isTodayDate={isToday(cell.date)}
                    onSelect={handleSelectDate}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Bottom: Selected date's group buys */}
        <View style={styles.dealsHeader}>
          <Text style={styles.dealsTitle}>
            {selectedDateKey === formatDateKey(today)
              ? '오늘의 공구'
              : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 공구`}
          </Text>
          <Text style={styles.dealsCount}>
            {showFollowedOnly ? `${selectedDateGroupBuys.length}개 (팔로잉)` : `${selectedDateGroupBuys.length}개`}
          </Text>
        </View>

        {isFetching && groupBuys.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : selectedDateGroupBuys.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.dealsGrid}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dealsGridInner}>
              {selectedDateGroupBuys.map((item, index) => (
                <DealCard
                  key={item.id}
                  item={item}
                  category={categoryForIndex(index)}
                  onPress={() => navigation.navigate('Detail', { groupBuy: item })}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyDeals}>
            <Text style={styles.emptyDealsTitle}>
              {showFollowedOnly ? '팔로잉 중인 인플루언서의 공구가 없어요' : '이 날짜의 공구가 없어요'}
            </Text>
            <Text style={styles.emptyDealsText}>
              {showFollowedOnly
                ? '필터를 해제하거나 다른 날짜를 선택해보세요.'
                : '아직 등록된 공동구매가 없습니다.'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.lg },

  // Header
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  headerNavGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    minWidth: 110,
    textAlign: 'center',
  },
  navArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  navArrowText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  todayButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },
  todayButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },

  // Filter chip (integrated into headerRow)
  filterChip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.lg,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Calendar grid
  calendarWrapper: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
  },
  weekdayText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  weekendText: {
    color: colors.textSecondary,
  },
  gridContainer: {
    gap: spacing.xxs,
  },
  weekRow: {
    flexDirection: 'row',
  },

  // Day cell
  dayCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: DAY_CELL_SIZE,
    paddingVertical: spacing.xxs,
  },
  dayCellOtherMonth: {
    opacity: 0.4,
  },
  dayCellToday: {
    borderColor: colors.ctaPurple,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  dayCellSelected: {
    backgroundColor: colors.ctaPurple,
    borderRadius: borderRadius.full,
    borderWidth: 0,
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  dayTextOtherMonth: {
    color: colors.textPrimary,
  },
  dayTextToday: {
    color: colors.ctaPurple,
  },
  dayTextSelected: {
    color: colors.ctaPurpleText,
  },

  // Dot indicator
  dot: {
    backgroundColor: colors.primary,
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    marginTop: 2,
    width: DOT_SIZE,
  },
  dotSelected: {
    backgroundColor: colors.ctaPurpleText,
  },
  dotSpacer: {
    height: DOT_SIZE + 2,
    marginTop: 2,
  },

  // Deals section
  dealsHeader: {
    alignItems: 'center',
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  dealsTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  dealsCount: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dealsGrid: {
    paddingBottom: spacing['2xl'],
  },
  dealsGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  // Loading
  loading: {
    marginTop: spacing['3xl'],
  },

  // Empty state
  emptyDeals: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing['2xl'],
  },
  emptyDealsTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyDealsText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
});
