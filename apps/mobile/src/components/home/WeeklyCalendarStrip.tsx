import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../../components/ui/SText';
import { borderRadius, spacing } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type WeeklyCalendarStripProps = {
  onPressCalendar: () => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
};

function getWeekDays() {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const today = new Date();
  const current = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - current);

  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, day: date.getDate(), date };
  });
}

export function WeeklyCalendarStrip({ onPressCalendar, selectedDate, onSelectDate }: WeeklyCalendarStripProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const weekDays = useMemo(() => getWeekDays(), []);
  const isSameDay = (a: Date | null, b: Date) =>
    a != null && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <View style={s.calendarSection}>
      <View style={s.calendarTitleRow}>
        <SText variant="cardTitle">이번주 공구</SText>
        <Pressable
          accessibilityLabel="전체 캘린더 보기"
          accessibilityRole="button"
          onPress={onPressCalendar}
          style={s.calendarViewAll}
        >
          <SText variant="cardBrand">전체보기</SText>
        </Pressable>
      </View>
      <View style={s.calendarStrip}>
        {weekDays.map((day) => (
          <Pressable
            key={`${day.label}-${day.day}`}
            style={s.calendarDay}
            accessibilityLabel={`${day.label} ${day.day}일 공구 보기`}
            accessibilityRole="button"
            onPress={() => onSelectDate(day.date)}
          >
            <SText variant="caption">
              {day.label}
            </SText>
            <View
              style={[
                s.calendarDateCircle,
                isSameDay(selectedDate, day.date) && s.calendarDateCircleSelected,
              ]}
            >
              <SText variant="label">
                {day.day}
              </SText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    calendarSection: { marginBottom: spacing.xl },
    calendarTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    calendarViewAll: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: 'transparent',
      borderWidth: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.xs,
    },
    calendarStrip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadius['2xl'],
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
      padding: spacing.md,
    },
    calendarDay: { alignItems: 'center', minHeight: 58, minWidth: 38 },
    calendarDateCircle: {
      alignItems: 'center',
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 36,
    },
    calendarDateCircleSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
  });
}
