import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { DealCard } from '../components/DealCard';
import { SText } from '../components/ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import type { CategoryColorName } from '../design/tokens';
import type { CalendarScreenProps, GroupBuy } from '../types';
import { formatDateKey, getGroupBuyDateRange, parseDateKey } from '../utils/groupBuyDates';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// ─── Constants ──────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const DAY_CELL_SIZE = 44;
const DOT_SIZE = 5;
const SWIPE_THRESHOLD = 50;

// Temp followed usernames — replace with real following state hook when available
const FOLLOWED_USERNAMES = new Set(['sample_influencer', 'mom_blogger', 'fitness_influencer']);

// ─── Date utilities ──────────────────────────────────────────────────────────

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
    const { start, end } = getGroupBuyDateRange(item);
    if (!start && !end) continue;

    const rangeStart = start ?? end;
    const rangeEnd = end ?? start;
    if (!rangeStart || !rangeEnd) continue;

    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(rangeEnd);
    last.setHours(0, 0, 0, 0);

    while (cursor <= last) {
      const key = formatDateKey(cursor);
      const existing = map.get(key);
      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

function categoryForIndex(index: number): CategoryColorName {
  const keys: CategoryColorName[] = ['food', 'living', 'beauty', 'fashion', 'home', 'kitchen', 'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports', 'stationery', 'books', 'media', 'travel'];
  return keys[index % keys.length];
}

// ─── Calendar Grid Sub-components ───────────────────────────────────────────

function CalendarHeader({
  year,
  month,
  colors,
  onPrevMonth,
  onNextMonth,
  onToday,
  showFollowedOnly,
  onToggleFilter,
  onOpenAlert,
}: {
  year: number;
  month: number;
  colors: ColorPalette;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  showFollowedOnly: boolean;
  onToggleFilter: () => void;
  onOpenAlert: () => void;
}) {
  const label = `${year}년 ${month + 1}월`;
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.headerRow}>
      {/* Left: 오늘 button */}
      <Pressable
        accessibilityLabel="오늘로 이동"
        accessibilityRole="button"
        onPress={onToday}
        style={s.todayButton}
      >
        <SText variant="body" style={{ color: colors.textInverse, fontSize: 14, fontWeight: '800' }}>
          오늘
        </SText>
      </Pressable>

      {/* Center: navigation arrows + title */}
      <View style={s.headerNavGroup}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={onPrevMonth}
          style={s.navArrow}
        >
          <SText variant="body" style={{ fontSize: 16 }}>◀</SText>
        </Pressable>
        <SText variant="cardTitle" style={{ fontSize: 20, fontWeight: '800', minWidth: 110, textAlign: 'center' }}>
          {label}
        </SText>
        <Pressable
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          onPress={onNextMonth}
          style={s.navArrow}
        >
          <SText variant="body" style={{ fontSize: 16 }}>▶</SText>
        </Pressable>
      </View>

      {/* Right: filter chip integrated into headerRow */}
      <Pressable
        accessibilityLabel={`팔로잉만 보기 ${showFollowedOnly ? '활성화' : '비활성화'}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: showFollowedOnly }}
        onPress={onToggleFilter}
        style={[
          s.filterChip,
          {
            backgroundColor: showFollowedOnly ? colors.primary : 'transparent',
            borderColor: showFollowedOnly ? colors.primary : colors.border,
          },
        ]}
      >
        <SText
          variant="cardBrand"
          style={[
            { fontWeight: '700' },
            { color: showFollowedOnly ? colors.textInverse : colors.textSecondary },
          ]}
        >
          {showFollowedOnly ? '✓ 팔로잉' : '팔로잉만 보기'}
        </SText>
      </Pressable>

      <Pressable
        accessibilityLabel="알림 설정"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenAlert}
        style={s.alertButton}
      >
        <SText variant="body" style={{ fontSize: 18 }}>🔔</SText>
      </Pressable>
    </View>
  );
}

function WeekdayHeader({ colors }: { colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.weekdayRow}>
      {WEEKDAY_LABELS.map((label) => (
        <View key={label} style={s.weekdayCell}>
          <SText variant="caption" style={[{ fontWeight: '700' }, label === '토' || label === '일' ? { color: colors.textSecondary } : undefined]}>
            {label}
          </SText>
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  isCurrentMonth,
  date,
  colors,
  hasGroupBuys,
  isSelected,
  isTodayDate,
  onSelect,
}: {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
  colors: ColorPalette;
  hasGroupBuys: boolean;
  isSelected: boolean;
  isTodayDate: boolean;
  onSelect: (date: Date) => void;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityLabel={`${day}일${isTodayDate ? ' (오늘)' : ''}`}
      accessibilityRole="button"
      onPress={() => onSelect(date)}
      style={[
        s.dayCell,
        !isCurrentMonth && s.dayCellOtherMonth,
        isTodayDate && s.dayCellToday,
        isSelected && s.dayCellSelected,
      ]}
    >
      <SText
        variant="subtitle"
        style={[
          { color: colors.textPrimary, fontWeight: '700', marginBottom: 0 },
          !isCurrentMonth && { color: colors.textPrimary },
          isTodayDate && !isSelected && { color: colors.primary },
          isSelected && { color: colors.textInverse },
        ]}
      >
        {day}
      </SText>
      {hasGroupBuys ? (
        <View
          style={[
            s.dot,
            isSelected && s.dotSelected,
          ]}
        />
      ) : (
        <View style={s.dotSpacer} />
      )}
    </Pressable>
  );
}

// ─── Main CalendarScreen ────────────────────────────────────────────────────

export function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const initialParam = route.params?.initialDate;
  const initialDate = (initialParam ? parseDateKey(initialParam) : null) ?? new Date();

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
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <View style={s.container}>
        {/* Top: Header with navigation + filter integrated */}
        <CalendarHeader
          year={currentYear}
          month={currentMonth}
          colors={colors}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
          showFollowedOnly={showFollowedOnly}
          onToggleFilter={() => setShowFollowedOnly((v) => !v)}
          onOpenAlert={() => Alert.alert('준비 중', '캘린더 알림 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}
        />

        {/* Middle: Calendar grid with swipe */}
        <View {...panResponder.panHandlers} style={s.calendarWrapper}>
          <WeekdayHeader colors={colors} />
          <View style={s.gridContainer}>
            {grid.map((week, wi) => (
              <View key={wi} style={s.weekRow}>
                {week.map((cell) => (
                  <DayCell
                    key={formatDateKey(cell.date)}
                    day={cell.day}
                    isCurrentMonth={cell.isCurrentMonth}
                    date={cell.date}
                    colors={colors}
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
        <View style={s.dealsHeader}>
          <SText variant="cardTitle" style={{ fontSize: 17, fontWeight: '800' }}>
            {selectedDateKey === formatDateKey(today)
              ? '오늘의 공구'
              : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 공구`}
          </SText>
          <SText variant="label">
            {showFollowedOnly ? `${selectedDateGroupBuys.length}개 (팔로잉)` : `${selectedDateGroupBuys.length}개`}
          </SText>
        </View>

        {isFetching && groupBuys.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={s.loading} />
        ) : selectedDateGroupBuys.length > 0 ? (
          <ScrollView
            contentContainerStyle={s.dealsGrid}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.dealsGridInner}>
              {selectedDateGroupBuys.map((item, index) => (
                <DealCard
                  key={item.id}
                  item={item}
                  category={item.category ?? categoryForIndex(index)}
                  onPress={() => navigation.navigate('Detail', { groupBuy: item })}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={s.emptyDeals}>
            <SText variant="subtitle" style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs }}>
              {showFollowedOnly ? '팔로잉 중인 인플루언서의 공구가 없어요' : '이 날짜의 공구가 없어요'}
            </SText>
            <SText variant="caption" style={{ fontSize: 13 }}>
              {showFollowedOnly
                ? '필터를 해제하거나 다른 날짜를 선택해보세요.'
                : '아직 등록된 공동구매가 없습니다.'}
            </SText>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, paddingHorizontal: spacing.lg, backgroundColor: colors.bg },

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
      gap: spacing.sm,
    },
    navArrow: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 40,
      minWidth: 40,
    },
    todayButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: spacing.lg,
    },
    // Filter chip (integrated into headerRow)
    filterChip: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: spacing.md,
    },
    alertButton: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 36,
    },
    // Calendar grid
    calendarWrapper: {
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.xxl,
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
      opacity: 0.36,
    },
    dayCellToday: {
      borderColor: colors.accent,
      borderRadius: commerceRadius.full,
      borderWidth: 1.5,
    },
    dayCellSelected: {
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.full,
      borderWidth: 0,
    },

    // Dot indicator
    dot: {
      backgroundColor: colors.accent,
      borderRadius: DOT_SIZE / 2,
      height: DOT_SIZE,
      marginTop: 2,
      width: DOT_SIZE,
    },
    dotSelected: {
      backgroundColor: colors.inverse,
    },
    dotSpacer: {
      height: DOT_SIZE + 2,
      marginTop: 2,
    },

    // Deals section
    dealsHeader: {
      alignItems: 'center',
      borderTopColor: colors.borderLight,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      paddingTop: spacing.md,
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
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing['2xl'],
    },
  });
}
