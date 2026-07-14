import { type Dispatch, useCallback, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { commerceRadius } from '../../design/commerce';
import { spacing } from '../../design/tokens';
import type { ColorPalette } from '../../context/ThemeContext';
import { formatDateKey } from '../../utils/groupBuyDates';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const DAY_CELL_SIZE = 36;
const DOT_SIZE = 5;

export type CalendarGrid = Array<
  Array<{ day: number; isCurrentMonth: boolean; date: Date }>
>;

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

function WeekdayHeader({ colors }: { colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.weekdayRow}>
      {WEEKDAY_LABELS.map((label) => (
        <View key={label} style={s.weekdayCell}>
          <SText
            variant="caption"
            style={[
              s.weekdayText,
              label === '토' || label === '일'
                ? s.weekdayTextWeekend
                : undefined,
            ]}
          >
            {label}
          </SText>
        </View>
      ))}
    </View>
  );
}

function DayCell({
  colors,
  date,
  day,
  hasGroupBuys,
  isCurrentMonth,
  isSelected,
  isTodayDate,
  onSelect,
}: {
  colors: ColorPalette;
  date: Date;
  day: number;
  hasGroupBuys: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isTodayDate: boolean;
  onSelect: Dispatch<Date>;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const handleSelect = useCallback(() => onSelect(date), [date, onSelect]);

  return (
    <Pressable
      accessibilityLabel={`${day}일${isTodayDate ? ' (오늘)' : ''}`}
      accessibilityRole="button"
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={handleSelect}
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
          s.dayText,
          !isCurrentMonth && s.dayTextOtherMonth,
          isTodayDate && !isSelected && s.dayTextToday,
          isSelected && s.dayTextSelected,
        ]}
      >
        {day}
      </SText>
      {hasGroupBuys ? (
        <View style={[s.dot, isSelected && s.dotSelected]} />
      ) : (
        <View style={s.dotSpacer} />
      )}
    </Pressable>
  );
}

export function CalendarPickerModal({
  colors,
  dateKeysWithBuys,
  grid,
  month,
  onClose,
  onNextMonth,
  onPrevMonth,
  onSelectDate,
  onToday,
  selectedDate,
  visible,
  year,
}: {
  colors: ColorPalette;
  dateKeysWithBuys: ReadonlySet<string>;
  grid: CalendarGrid;
  month: number;
  onClose: () => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onSelectDate: Dispatch<Date>;
  onToday: () => void;
  selectedDate: Date;
  visible: boolean;
  year: number;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={s.overlay}
        testID="calendar-picker-modal"
      >
        <Pressable
          accessibilityLabel="달력 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={s.backdrop}
        />
        <View style={s.card}>
          <View style={s.header}>
            <Pressable
              accessibilityLabel="이전 달"
              accessibilityRole="button"
              onPress={onPrevMonth}
              style={s.navArrow}
            >
              <SText variant="body" style={s.navArrowText}>
                ‹
              </SText>
            </Pressable>
            <SText variant="cardTitle" style={s.title}>
              {year}년 {month + 1}월
            </SText>
            <Pressable
              accessibilityLabel="다음 달"
              accessibilityRole="button"
              onPress={onNextMonth}
              style={s.navArrow}
            >
              <SText variant="body" style={s.navArrowText}>
                ›
              </SText>
            </Pressable>
          </View>

          <View style={s.actions}>
            <Pressable
              accessibilityLabel="오늘로 이동"
              accessibilityRole="button"
              onPress={onToday}
              style={s.todayButton}
            >
              <SText variant="body" style={s.todayButtonText}>
                오늘
              </SText>
            </Pressable>
            <Pressable
              accessibilityLabel="달력 닫기"
              accessibilityRole="button"
              onPress={onClose}
              style={s.closeButton}
            >
              <SText variant="body" style={s.closeButtonText}>
                닫기
              </SText>
            </Pressable>
          </View>

          <View style={s.calendar} testID="calendar-grid">
            <WeekdayHeader colors={colors} />
            <View style={s.grid}>
              {grid.map((week) => (
                <View key={formatDateKey(week[0].date)} style={s.weekRow}>
                  {week.map((cell) => (
                    <DayCell
                      key={formatDateKey(cell.date)}
                      colors={colors}
                      date={cell.date}
                      day={cell.day}
                      hasGroupBuys={dateKeysWithBuys.has(
                        formatDateKey(cell.date),
                      )}
                      isCurrentMonth={cell.isCurrentMonth}
                      isSelected={isSameDay(cell.date, selectedDate)}
                      isTodayDate={isToday(cell.date)}
                      onSelect={onSelectDate}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    backdrop: {
      backgroundColor: colors.overlay,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    card: {
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.xxl,
      borderWidth: 1,
      maxWidth: 420,
      padding: spacing.md,
      width: '100%',
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '900',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.sm,
    },
    navArrow: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 40,
      minWidth: 40,
    },
    navArrowText: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: '700',
      lineHeight: 28,
    },
    todayButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: spacing.lg,
    },
    todayButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    closeButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: spacing.lg,
    },
    closeButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
    calendar: {
      backgroundColor: colors.panelBg,
      flexShrink: 0,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.xxs,
    },
    weekdayCell: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 24,
    },
    weekdayText: { fontWeight: '700' },
    weekdayTextWeekend: { color: colors.textSecondary },
    grid: { gap: spacing.xxs },
    weekRow: { flexDirection: 'row' },
    dayCell: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: DAY_CELL_SIZE,
      paddingVertical: spacing.xxs,
    },
    dayCellOtherMonth: { opacity: 0.36 },
    dayCellToday: {
      borderColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.full,
      borderWidth: 1.5,
    },
    dayCellSelected: {
      backgroundColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.full,
      borderWidth: 0,
    },
    dayText: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: 0,
    },
    dayTextOtherMonth: { color: colors.textPrimary },
    dayTextToday: { color: colors.primary },
    dayTextSelected: { color: colors.textInverse },
    dot: {
      backgroundColor: colors.accent,
      borderRadius: DOT_SIZE / 2,
      height: DOT_SIZE,
      marginTop: 2,
      width: DOT_SIZE,
    },
    dotSelected: { backgroundColor: colors.inverse },
    dotSpacer: { height: DOT_SIZE + 2, marginTop: 2 },
  });
}
