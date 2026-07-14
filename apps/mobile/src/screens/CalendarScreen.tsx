import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { BackButton } from '../components/BackButton';
import {
  CALENDAR_DATE_SECTION_HEIGHT,
  CalendarDateRow,
  calendarDateGroupKey,
  getCalendarDateGroupLayout,
  type CalendarDateGroup,
} from '../components/calendar/CalendarDateRow';
import {
  CalendarPickerModal,
  type CalendarGrid,
} from '../components/calendar/CalendarPickerModal';
import { SText } from '../components/ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import type { CalendarScreenProps, GroupBuy } from '../types';
import {
  formatDateKey,
  getGroupBuyDateRange,
  parseDateKey,
} from '../utils/groupBuyDates';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { useBookmarks, useNotifications } from '../hooks/useLocalDeals';

// ─── Constants ──────────────────────────────────────────────────────────────

export type CalendarActivityFilter = 'bookmarked' | 'notified';
export type CalendarFilter = Record<CalendarActivityFilter, boolean>;

const CALENDAR_FILTER_OPTIONS: Array<{
  value: CalendarActivityFilter;
  label: string;
  summaryLabel: string;
}> = [
  { value: 'bookmarked', label: '북마크', summaryLabel: '북마크' },
  { value: 'notified', label: '알림', summaryLabel: '알림' },
];
const CALENDAR_ALL_FILTER_LABEL = '전체 보기';

export function filterGroupBuysByActivity(
  groupBuys: GroupBuy[],
  filter: CalendarFilter,
  bookmarkedIds: ReadonlySet<string>,
  notifiedIds: ReadonlySet<string>,
): GroupBuy[] {
  if (!filter.bookmarked && !filter.notified) return groupBuys;

  return groupBuys.filter((groupBuy) => {
    const matchesBookmark = filter.bookmarked && bookmarkedIds.has(groupBuy.id);
    const matchesNotification = filter.notified && notifiedIds.has(groupBuy.id);
    return matchesBookmark || matchesNotification;
  });
}

function getCalendarFilterLabel(filter: CalendarFilter): string | null {
  const labels = CALENDAR_FILTER_OPTIONS.filter(
    (option) => filter[option.value],
  ).map((option) => option.summaryLabel);
  return labels.length > 0 ? labels.join(' · ') : null;
}

// ─── Date utilities ──────────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): CalendarGrid {
  const weeks: Array<
    Array<{ day: number; isCurrentMonth: boolean; date: Date }>
  > = [];
  const firstDay = new Date(year, month, 1);
  // getDay(): 0=Sun → convert to Mon=0-based
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let currentWeek: Array<{ day: number; isCurrentMonth: boolean; date: Date }> =
    [];

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

// ─── Calendar Grid Sub-components ───────────────────────────────────────────

function CalendarFilterBar({
  colors,
  filter,
  onClear,
  onToggle,
}: {
  colors: ColorPalette;
  filter: CalendarFilter;
  onClear: () => void;
  onToggle: Dispatch<CalendarActivityFilter>;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isAllSelected = !filter.bookmarked && !filter.notified;

  return (
    <View style={s.filterSection} testID="calendar-filter-bar">
      <SText variant="caption" style={s.filterLabel}>
        공구 필터
      </SText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        <Pressable
          accessibilityLabel={`${CALENDAR_ALL_FILTER_LABEL} ${isAllSelected ? '선택됨' : '선택 안 됨'}`}
          accessibilityRole="button"
          onPress={onClear}
          style={[
            s.filterChip,
            {
              backgroundColor: isAllSelected ? colors.primary : colors.panelBg,
              borderColor: isAllSelected ? colors.primary : colors.border,
            },
          ]}
          testID="calendar-filter-all"
        >
          <SText
            variant="caption"
            style={{
              color: isAllSelected ? colors.textInverse : colors.textSecondary,
              fontWeight: '800',
            }}
          >
            {CALENDAR_ALL_FILTER_LABEL}
          </SText>
        </Pressable>
        {CALENDAR_FILTER_OPTIONS.map((option) => {
          const selected = filter[option.value];
          return (
            <Pressable
              key={option.value}
              accessibilityLabel={`${option.label} ${selected ? '선택됨' : '선택 안 됨'}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => onToggle(option.value)}
              style={[
                s.filterChip,
                {
                  backgroundColor: selected ? colors.primary : colors.panelBg,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
              testID={`calendar-filter-${option.value}`}
            >
              <SText
                variant="caption"
                style={{
                  color: selected ? colors.textInverse : colors.textSecondary,
                  fontWeight: '800',
                }}
              >
                {option.label}
              </SText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CalendarHeader({
  year,
  month,
  colors,
  filter,
  onClearFilter,
  onToggleFilter,
  onGoBack,
  isCalendarPickerVisible,
  onToggleCalendar,
}: {
  year: number;
  month: number;
  colors: ColorPalette;
  filter: CalendarFilter;
  onClearFilter: () => void;
  onToggleFilter: Dispatch<CalendarActivityFilter>;
  onGoBack: () => void;
  isCalendarPickerVisible: boolean;
  onToggleCalendar: () => void;
}) {
  const label = `${year}년 ${month + 1}월`;
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.header} testID="calendar-header">
      <View style={s.titleRow}>
        <BackButton
          accessibilityLabel="뒤로가기"
          onPress={onGoBack}
          style={s.backButton}
          testID="calendar-back-button"
        />
        <SText variant="cardTitle" style={s.screenTitle}>
          공구 캘린더
        </SText>
        <View style={s.titleSpacer} />
      </View>

      <View style={s.monthRow}>
        <Pressable
          accessibilityLabel={`${label} 달력 ${isCalendarPickerVisible ? '닫기' : '열기'}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isCalendarPickerVisible }}
          onPress={onToggleCalendar}
          style={s.monthToggle}
          testID="calendar-month-toggle"
        >
          <SText variant="cardTitle" style={s.monthTitle}>
            {label}
          </SText>
          <SText variant="body" style={s.calendarToggleIcon}>
            {isCalendarPickerVisible ? '▲' : '▼'}
          </SText>
        </Pressable>
      </View>

      <CalendarFilterBar
        colors={colors}
        filter={filter}
        onClear={onClearFilter}
        onToggle={onToggleFilter}
      />
    </View>
  );
}

// ─── Main CalendarScreen ────────────────────────────────────────────────────

export function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const initialParam = route.params?.initialDate;
  const initialDate =
    (initialParam ? parseDateKey(initialParam) : null) ?? new Date();

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>({
    bookmarked: false,
    notified: false,
  });
  const dateListRef = useRef<FlatList<CalendarDateGroup> | null>(null);
  const pendingScrollDateKeyRef = useRef<string | null>(null);
  const { bookmarks } = useBookmarks();
  const { notifications } = useNotifications();

  // Data fetching
  const { data, isFetching } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const groupBuys = data?.length ? data : fallbackGroupBuys;

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((item) => item.id)),
    [bookmarks],
  );
  const notifiedIds = useMemo(
    () => new Set(notifications.map((item) => item.groupBuyId)),
    [notifications],
  );

  const filteredGroupBuys = useMemo(
    () =>
      filterGroupBuysByActivity(
        groupBuys,
        calendarFilter,
        bookmarkedIds,
        notifiedIds,
      ),
    [bookmarkedIds, calendarFilter, groupBuys, notifiedIds],
  );
  const groupBuysByDate = useMemo(
    () => groupGroupBuysByDate(filteredGroupBuys),
    [filteredGroupBuys],
  );
  const dateKeysWithBuys = useMemo(() => {
    const set = new Set<string>();
    for (const [key] of groupBuysByDate) {
      set.add(key);
    }
    return set;
  }, [groupBuysByDate]);
  const selectedDateKey = useMemo(
    () => formatDateKey(selectedDate),
    [selectedDate],
  );
  const dateGroups = useMemo(() => {
    const keys = new Set<string>();
    for (const key of groupBuysByDate.keys()) {
      const date = parseDateKey(key);
      if (
        date?.getFullYear() === currentYear &&
        date.getMonth() === currentMonth
      ) {
        keys.add(key);
      }
    }
    if (
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth() === currentMonth
    ) {
      keys.add(selectedDateKey);
    }

    return Array.from(keys)
      .sort()
      .map((dateKey) => ({
        date: parseDateKey(dateKey)!,
        dateKey,
        items: groupBuysByDate.get(dateKey) ?? [],
      }));
  }, [
    currentMonth,
    currentYear,
    groupBuysByDate,
    selectedDate,
    selectedDateKey,
  ]);
  const selectedDateIndex = useMemo(
    () => dateGroups.findIndex((group) => group.dateKey === selectedDateKey),
    [dateGroups, selectedDateKey],
  );
  const calendarFilterLabel = useMemo(
    () => getCalendarFilterLabel(calendarFilter),
    [calendarFilter],
  );
  const grid = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const clearCalendarFilter = useCallback(() => {
    setCalendarFilter({ bookmarked: false, notified: false });
  }, []);
  const toggleCalendarFilter = useCallback((filter: CalendarActivityFilter) => {
    setCalendarFilter((current) => ({
      ...current,
      [filter]: !current[filter],
    }));
  }, []);
  const toggleCalendar = useCallback(() => {
    setIsCalendarExpanded((expanded) => !expanded);
  }, []);
  const closeCalendar = useCallback(() => {
    setIsCalendarExpanded(false);
  }, []);

  // Reset filter state on screen re-entry
  useEffect(() => {
    clearCalendarFilter();
    setIsCalendarExpanded(false);
  }, [clearCalendarFilter, route.key]);

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
    pendingScrollDateKeyRef.current = formatDateKey(now);
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(now);
    setIsCalendarExpanded(false);
  }, []);

  const handleSelectDate = useCallback(
    (date: Date) => {
      pendingScrollDateKeyRef.current = formatDateKey(date);
      setSelectedDate(date);
      // If the selected date is in a different month, navigate to that month
      if (
        date.getMonth() !== currentMonth ||
        date.getFullYear() !== currentYear
      ) {
        setCurrentYear(date.getFullYear());
        setCurrentMonth(date.getMonth());
      }
      setIsCalendarExpanded(false);
    },
    [currentMonth, currentYear],
  );

  useEffect(() => {
    const pendingDateKey = pendingScrollDateKeyRef.current;
    if (!pendingDateKey) return;
    const index = dateGroups.findIndex(
      (group) => group.dateKey === pendingDateKey,
    );
    if (index < 0) return;

    dateListRef.current?.scrollToIndex({
      animated: true,
      index,
      viewPosition: 0,
    });
    pendingScrollDateKeyRef.current = null;
  }, [dateGroups]);

  const openDealDetail = useCallback(
    (item: GroupBuy) => navigation.navigate('Detail', { groupBuy: item }),
    [navigation],
  );
  const renderDateGroup = useCallback(
    ({ item }: { item: CalendarDateGroup }) => (
      <CalendarDateRow
        {...item}
        filterLabel={calendarFilterLabel}
        isSelected={item.dateKey === selectedDateKey}
        onDealPress={openDealDetail}
      />
    ),
    [calendarFilterLabel, openDealDetail, selectedDateKey],
  );
  const handleScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      dateListRef.current?.scrollToOffset({
        animated: true,
        offset: CALENDAR_DATE_SECTION_HEIGHT * index,
      });
    },
    [],
  );
  const renderEmptyTimeline = useCallback(
    () =>
      isFetching && groupBuys.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={s.loading} />
      ) : (
        <View style={s.emptyDeals}>
          <SText variant="subtitle" style={s.emptyDateTitle}>
            {calendarFilterLabel
              ? '선택한 필터의 공구가 없어요'
              : '이 달의 공구가 없어요'}
          </SText>
          <SText variant="caption">
            {calendarFilterLabel
              ? '필터를 바꾸거나 다른 달을 선택해보세요.'
              : '상단 달력에서 다른 달을 선택해보세요.'}
          </SText>
        </View>
      ),
    [
      calendarFilterLabel,
      colors.primary,
      groupBuys.length,
      isFetching,
      s.emptyDateTitle,
      s.emptyDeals,
      s.loading,
    ],
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <View style={s.container}>
        {/* Top: Header with navigation + filter integrated */}
        <CalendarHeader
          year={currentYear}
          month={currentMonth}
          colors={colors}
          filter={calendarFilter}
          onClearFilter={clearCalendarFilter}
          onToggleFilter={toggleCalendarFilter}
          onGoBack={navigation.goBack}
          isCalendarPickerVisible={isCalendarExpanded}
          onToggleCalendar={toggleCalendar}
        />

        <CalendarPickerModal
          colors={colors}
          dateKeysWithBuys={dateKeysWithBuys}
          grid={grid}
          month={currentMonth}
          onClose={closeCalendar}
          onNextMonth={goToNextMonth}
          onPrevMonth={goToPrevMonth}
          onSelectDate={handleSelectDate}
          onToday={goToToday}
          selectedDate={selectedDate}
          visible={isCalendarExpanded}
          year={currentYear}
        />

        <FlatList
          contentContainerStyle={s.dateListContent}
          data={dateGroups}
          getItemLayout={getCalendarDateGroupLayout}
          initialScrollIndex={
            selectedDateIndex >= 0 ? selectedDateIndex : undefined
          }
          keyExtractor={calendarDateGroupKey}
          ListEmptyComponent={renderEmptyTimeline}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          ref={dateListRef}
          renderItem={renderDateGroup}
          showsVerticalScrollIndicator={false}
          style={s.contentScroll}
          testID="calendar-date-list"
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.bg,
    },

    // Header stays fixed while the calendar and product list share one scroll.
    header: {
      flexShrink: 0,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    backButton: {
      height: 44,
      width: 44,
    },
    screenTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    titleSpacer: {
      width: 44,
    },
    monthRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    monthTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      minWidth: 110,
      textAlign: 'center',
    },
    monthToggle: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      flexDirection: 'row',
      gap: spacing.xxs,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    calendarToggleIcon: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    filterSection: {
      marginTop: spacing.xs,
    },
    filterLabel: {
      color: colors.textSecondary,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    filterBar: {
      gap: spacing.xs,
      paddingRight: spacing.lg,
    },
    filterChip: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: spacing.md,
    },
    contentScroll: {
      flex: 1,
      minHeight: 0,
    },
    dateListContent: {
      paddingBottom: spacing['2xl'],
    },
    emptyDateTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: spacing.xs,
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
