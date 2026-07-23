import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { fetchGroupBuys } from "../api";
import { useAds } from "../ads/AdsContext";
import { BackButton } from "../components/BackButton";
import {
  CalendarDateRow,
  getCalendarLayoutMetrics,
  type CalendarDateGroup,
} from "../components/calendar/CalendarDateRow";
import { NativeAdCard } from "../components/ads/NativeAdCard";
import type { NativeAdLoadStatus } from "../components/ads/NativeAdCard.types";
import {
  CalendarPickerModal,
  type CalendarGrid,
} from "../components/calendar/CalendarPickerModal";
import { SText } from "../components/ui/SText";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { spacing } from "../design/tokens";
import { commerceRadius } from "../design/commerce";
import type { CalendarScreenProps, GroupBuy } from "../types";
import {
  formatDateKey,
  getGroupBuyDateRange,
  parseDateKey,
} from "../utils/groupBuyDates";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../context/ThemeContext";
import { useBookmarks, useNotifications } from "../hooks/useLocalDeals";
import {
  insertReelsAdSlots,
  isReelsContentItem,
  seedAdRandomFromIds,
  type ReelsFeedItem,
} from "./reelsAdPlacement";

// ─── Constants ──────────────────────────────────────────────────────────────

export type CalendarActivityFilter = "bookmarked" | "notified";
export type CalendarFilter = Record<CalendarActivityFilter, boolean>;

const CALENDAR_FILTER_OPTIONS: Array<{
  value: CalendarActivityFilter;
  label: string;
  summaryLabel: string;
}> = [
  { value: "bookmarked", label: "북마크", summaryLabel: "북마크" },
  { value: "notified", label: "알림", summaryLabel: "알림" },
];
const CALENDAR_ALL_FILTER_LABEL = "전체 보기";
const CALENDAR_NATIVE_AD_BASE_HEIGHT = 152;
const CALENDAR_NATIVE_AD_SCALE_DELTA = 72;

type CalendarTimelineDateGroup = CalendarDateGroup & { id: string };
type CalendarTimelineItem = ReelsFeedItem<CalendarTimelineDateGroup>;

function calendarTimelineItemKey(item: CalendarTimelineItem) {
  return item.key;
}

function getCalendarTimelineItemLayout(
  data: ArrayLike<CalendarTimelineItem> | null | undefined,
  index: number,
  dateSectionHeight: number,
  adSectionHeight: number,
) {
  let offset = 0;
  for (let itemIndex = 0; itemIndex < index; itemIndex++) {
    const item = data?.[itemIndex];
    offset +=
      item && !isReelsContentItem(item)
        ? adSectionHeight
        : dateSectionHeight;
  }
  const item = data?.[index];
  return {
    index,
    length:
      item && !isReelsContentItem(item)
        ? adSectionHeight
        : dateSectionHeight,
    offset,
  };
}

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
  return labels.length > 0 ? labels.join(" · ") : null;
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
  onToday,
  onToggle,
}: {
  colors: ColorPalette;
  filter: CalendarFilter;
  onClear: () => void;
  onToday: () => void;
  onToggle: Dispatch<CalendarActivityFilter>;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isAllSelected = !filter.bookmarked && !filter.notified;

  return (
    <View style={s.filterSection} testID="calendar-filter-bar">
      <View style={s.filterHeader} testID="calendar-filter-actions">
        <SText variant="caption" style={s.filterLabel}>
          공구 필터
        </SText>
        <Pressable
          accessibilityLabel="오늘로 이동"
          accessibilityRole="button"
          onPress={onToday}
          style={s.todayButton}
          testID="calendar-today-button"
        >
          <SText variant="caption" style={s.todayButtonText}>
            오늘
          </SText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        <Pressable
          accessibilityLabel={`${CALENDAR_ALL_FILTER_LABEL} ${isAllSelected ? "선택됨" : "선택 안 됨"}`}
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
              fontWeight: "800",
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
              accessibilityLabel={`${option.label} ${selected ? "선택됨" : "선택 안 됨"}`}
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
                  fontWeight: "800",
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
  onToday,
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
  onToday: () => void;
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

      <View style={s.monthRow} testID="calendar-month-row">
        <Pressable
          accessibilityLabel={`${label} 달력 ${isCalendarPickerVisible ? "닫기" : "열기"}`}
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
            {isCalendarPickerVisible ? "▲" : "▼"}
          </SText>
        </Pressable>
      </View>

      <CalendarFilterBar
        colors={colors}
        filter={filter}
        onClear={onClearFilter}
        onToday={onToday}
        onToggle={onToggleFilter}
      />
    </View>
  );
}

// ─── Main CalendarScreen ────────────────────────────────────────────────────

export function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const calendarLayoutMetrics = useMemo(
    () => getCalendarLayoutMetrics(fontScale),
    [fontScale],
  );
  const normalizedAdFontScale = Number.isFinite(fontScale)
    ? Math.min(2, Math.max(1, fontScale))
    : 1;
  const calendarAdRowHeight =
    CALENDAR_NATIVE_AD_BASE_HEIGHT +
    Math.round((normalizedAdFontScale - 1) * CALENDAR_NATIVE_AD_SCALE_DELTA);
  const { enabled: adsEnabled, isReady: adsReady, nativeUnitIds } = useAds();
  const [calendarAdsUnavailable, setCalendarAdsUnavailable] = useState(false);

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
  const dateListRef = useRef<FlatList<CalendarTimelineItem> | null>(null);
  const pendingScrollDateKeyRef = useRef<string | null>(null);
  const { bookmarks } = useBookmarks();
  const { notifications } = useNotifications();

  // Data fetching
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["group-buys"],
    queryFn: fetchGroupBuys,
  });

  const groupBuys = data ?? [];

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
        id: dateKey,
        items: groupBuysByDate.get(dateKey) ?? [],
      }));
  }, [
    currentMonth,
    currentYear,
    groupBuysByDate,
    selectedDate,
    selectedDateKey,
  ]);
  const canShowCalendarAds =
    adsEnabled &&
    adsReady &&
    Boolean(nativeUnitIds.home) &&
    !calendarAdsUnavailable;
  const timelineItems = useMemo<CalendarTimelineItem[]>(
    () =>
      insertReelsAdSlots(dateGroups, {
        boundFirstGapToFeed: true,
        enabled: canShowCalendarAds,
        includeTrailingAd: true,
        random: seedAdRandomFromIds(dateGroups.map((group) => group.id)),
      }),
    [canShowCalendarAds, dateGroups],
  );
  const selectedDateIndex = useMemo(
    () =>
      timelineItems.findIndex(
        (item) =>
          isReelsContentItem(item) &&
          item.content.dateKey === selectedDateKey,
      ),
    [selectedDateKey, timelineItems],
  );
  const timelineLayoutSignature =
    `${canShowCalendarAds}:` +
    `${calendarLayoutMetrics.sectionHeight}:${calendarAdRowHeight}`;
  const previousTimelineLayoutSignatureRef = useRef(timelineLayoutSignature);
  useEffect(() => {
    const layoutChanged =
      previousTimelineLayoutSignatureRef.current !== timelineLayoutSignature;
    previousTimelineLayoutSignatureRef.current = timelineLayoutSignature;
    if (
      !layoutChanged ||
      pendingScrollDateKeyRef.current ||
      selectedDateIndex < 0
    ) {
      return;
    }
    dateListRef.current?.scrollToIndex({
      animated: false,
      index: selectedDateIndex,
      viewPosition: 0,
    });
  }, [selectedDateIndex, timelineLayoutSignature]);
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
    const index = timelineItems.findIndex(
      (item) =>
        isReelsContentItem(item) && item.content.dateKey === pendingDateKey,
    );
    if (index < 0) return;

    dateListRef.current?.scrollToIndex({
      animated: true,
      index,
      viewPosition: 0,
    });
    pendingScrollDateKeyRef.current = null;
  }, [timelineItems]);

  const openDealDetail = useCallback(
    (item: GroupBuy) => navigation.navigate("Detail", { groupBuy: item }),
    [navigation],
  );
  const handleCalendarAdLoadStateChange = useCallback(
    (status: NativeAdLoadStatus) => {
      if (status === "unavailable") setCalendarAdsUnavailable(true);
    },
    [],
  );
  const renderDateGroup = useCallback(
    ({ item }: { item: CalendarTimelineItem }) => {
      if (!isReelsContentItem(item)) {
        return (
          <View
            style={[s.calendarAdSlot, { height: calendarAdRowHeight }]}
            testID={`calendar-native-ad-slot-${item.sequence}`}
          >
            <View
              accessibilityLiveRegion="polite"
              style={s.calendarAdLoading}
            >
              <SText variant="caption" style={s.calendarAdLoadingLabel}>
                광고
              </SText>
              <SText variant="body" style={s.calendarAdLoadingText}>
                광고를 불러오는 중이에요
              </SText>
            </View>
            <NativeAdCard
              onLoadStateChange={handleCalendarAdLoadStateChange}
              placement="home"
              style={s.calendarNativeAdCard}
              testID={`calendar-native-ad-${item.sequence}`}
              variant="row"
            />
          </View>
        );
      }
      const dateGroup = item.content;
      return (
        <CalendarDateRow
          date={dateGroup.date}
          dateKey={dateGroup.dateKey}
          filterLabel={calendarFilterLabel}
          isSelected={dateGroup.dateKey === selectedDateKey}
          items={dateGroup.items}
          layoutMetrics={calendarLayoutMetrics}
          onDealPress={openDealDetail}
        />
      );
    },
    [
      calendarAdRowHeight,
      calendarFilterLabel,
      calendarLayoutMetrics,
      handleCalendarAdLoadStateChange,
      openDealDetail,
      s.calendarAdLoading,
      s.calendarAdLoadingLabel,
      s.calendarAdLoadingText,
      s.calendarAdSlot,
      s.calendarNativeAdCard,
      selectedDateKey,
    ],
  );
  const getDateGroupLayout = useCallback(
    (
      data: ArrayLike<CalendarTimelineItem> | null | undefined,
      index: number,
    ) =>
      getCalendarTimelineItemLayout(
        data,
        index,
        calendarLayoutMetrics.sectionHeight,
        calendarAdRowHeight,
      ),
    [calendarAdRowHeight, calendarLayoutMetrics.sectionHeight],
  );
  const handleScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      dateListRef.current?.scrollToOffset({
        animated: true,
        offset: getCalendarTimelineItemLayout(
          timelineItems,
          index,
          calendarLayoutMetrics.sectionHeight,
          calendarAdRowHeight,
        ).offset,
      });
    },
    [calendarAdRowHeight, calendarLayoutMetrics.sectionHeight, timelineItems],
  );
  const renderEmptyTimeline = useCallback(
    () =>
      isError && groupBuys.length === 0 ? null : isFetching && groupBuys.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={s.loading} />
      ) : (
        <View style={s.emptyDeals}>
          <SText variant="subtitle" style={s.emptyDateTitle}>
            {calendarFilterLabel
              ? "선택한 필터의 공구가 없어요"
              : "이 달의 공구가 없어요"}
          </SText>
          <SText variant="caption">
            {calendarFilterLabel
              ? "필터를 바꾸거나 다른 달을 선택해보세요."
              : "상단 달력에서 다른 달을 선택해보세요."}
          </SText>
        </View>
      ),
    [
      calendarFilterLabel,
      colors.primary,
      groupBuys.length,
      isError,
      isFetching,
      s.emptyDateTitle,
      s.emptyDeals,
      s.loading,
    ],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <View style={s.container}>
        {/* Top: Header with navigation + filter integrated */}
        <CalendarHeader
          year={currentYear}
          month={currentMonth}
          colors={colors}
          filter={calendarFilter}
          onClearFilter={clearCalendarFilter}
          onToggleFilter={toggleCalendarFilter}
          onToday={goToToday}
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

        {isError ? (
          <AsyncStateNotice
            compact
            isRetrying={isFetching}
            message={
              groupBuys.length > 0
                ? "저장된 공구 일정을 계속 표시하고 있어요."
                : "네트워크 연결 상태를 확인하고 다시 시도해주세요."
            }
            onRetry={refetch}
            style={s.queryState}
            testID="calendar-query-state"
            title={
              groupBuys.length > 0
                ? "최신 공구 일정을 확인하지 못했어요"
                : "공구 정보를 불러오지 못했어요"
            }
            variant={groupBuys.length > 0 ? "stale" : "error"}
          />
        ) : null}

        {/*
          One visible month has at most 31 date rows plus fixed-height ad rows.
          Shared font-scale metrics keep rendered height, fallback offsets, and
          getItemLayout aligned while Dynamic Type changes.
        */}
        <FlatList
          contentContainerStyle={s.dateListContent}
          data={isError && groupBuys.length === 0 ? [] : timelineItems}
          getItemLayout={getDateGroupLayout}
          initialScrollIndex={
            selectedDateIndex >= 0 ? selectedDateIndex : undefined
          }
          keyExtractor={calendarTimelineItemKey}
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
    queryState: {
      marginHorizontal: spacing.lg,
    },

    // Header stays fixed while the calendar and product list share one scroll.
    header: {
      flexShrink: 0,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    titleRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
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
      fontWeight: "900",
      textAlign: "center",
    },
    titleSpacer: {
      width: 44,
    },
    monthRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    monthTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      minWidth: 110,
      textAlign: "center",
    },
    monthToggle: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      flexDirection: "row",
      gap: spacing.xxs,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    todayButton: {
      alignItems: "center",
      backgroundColor: colors.primaryBg,
      borderColor: colors.primary,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 34,
      paddingHorizontal: spacing.md,
    },
    todayButtonText: {
      color: colors.primary,
      fontWeight: "800",
    },
    calendarToggleIcon: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "800",
    },
    filterHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 34,
    },
    filterSection: {
      marginTop: spacing.xs,
    },
    filterLabel: {
      color: colors.textSecondary,
      fontWeight: "800",
    },
    filterBar: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
      paddingRight: spacing.lg,
    },
    filterChip: {
      alignItems: "center",
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 34,
      paddingHorizontal: spacing.md,
    },
    contentScroll: {
      flex: 1,
      minHeight: 0,
    },
    dateListContent: {
      paddingBottom: spacing["2xl"],
    },
    calendarAdSlot: {
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: "relative",
    },
    calendarAdLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    calendarAdLoadingLabel: {
      color: colors.textSecondary,
      fontWeight: "800",
      marginBottom: spacing.xs,
    },
    calendarAdLoadingText: {
      color: colors.textSecondary,
      textAlign: "center",
    },
    calendarNativeAdCard: {
      flex: 1,
      marginBottom: 0,
    },
    emptyDateTitle: {
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },

    // Loading
    loading: {
      marginTop: spacing["3xl"],
    },

    // Empty state
    emptyDeals: {
      alignItems: "center",
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing["2xl"],
    },
  });
}
