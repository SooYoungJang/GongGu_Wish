import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WeeklyCalendarStrip } from './WeeklyCalendarStrip';
import { formatDateKey } from '../../utils/groupBuyDates';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Pressable: ({ children, disabled, onPress, ...props }: any) =>
      ReactMock.createElement(
        'Pressable',
        {
          ...props,
          disabled,
          onPress: disabled ? undefined : onPress,
        },
        children,
      ),
    StyleSheet: { create: (styles: unknown) => styles },
    View: passthrough('View'),
  };
});

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#E45757',
      textInverse: '#FFFFFF',
    },
  }),
}));

vi.mock('../../components/ui/SText', () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('SText', props, children),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('WeeklyCalendarStrip', () => {
  it('disables earlier days this week and keeps today and future days selectable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 12));
    const onSelectDate = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <WeeklyCalendarStrip
          onPressCalendar={vi.fn()}
          onSelectDate={onSelectDate}
          selectedDate={new Date(2026, 7, 19)}
        />,
      );
    });

    const findDay = (label: string) =>
      renderer!.root.find(
        (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label,
      );
    const monday = findDay('월 17일 공구 보기');
    const today = findDay('수 19일 공구 보기');
    const thursday = findDay('목 20일 공구 보기');

    expect(monday.props.disabled).toBe(true);
    expect(monday.props.accessibilityState).toMatchObject({ disabled: true });
    expect(monday.props.onPress).toBeUndefined();
    expect(monday.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 0.36 })]),
    );
    expect(today.props.disabled).toBe(false);
    expect(today.props.accessibilityState).toMatchObject({
      disabled: false,
      selected: true,
    });
    expect(thursday.props.disabled).toBe(false);

    act(() => thursday.props.onPress());
    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(formatDateKey(onSelectDate.mock.calls[0][0])).toBe('2026-08-20');

    renderer!.unmount();
  });
});
