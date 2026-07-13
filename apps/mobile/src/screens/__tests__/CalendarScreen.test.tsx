import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarScreen, filterGroupBuysByActivity } from '../CalendarScreen';
import { ThemeProvider } from '../../context/ThemeContext';
import { spacing } from '../../design/tokens';
import type { GroupBuy } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../api', () => ({
  fallbackGroupBuys: [],
  fetchGroupBuys: vi.fn(),
}));

const activityMock = vi.hoisted(() => ({
  bookmarks: [] as Array<{ id: string }>,
  notifications: [] as Array<{ groupBuyId: string }>,
}));

vi.mock('../../hooks/useLocalDeals', () => ({
  useBookmarks: () => ({ bookmarks: activityMock.bookmarks, ready: true }),
  useNotifications: () => ({
    notifications: activityMock.notifications,
    ready: true,
  }),
}));

vi.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
}));

// Shared mutable query mock for tests that need custom return data
let mockQueryResult: {
  data: GroupBuy[] | null;
  isFetching: boolean;
  isError: boolean;
} = {
  data: null,
  isFetching: false,
  isError: false,
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryResult,
}));

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough('ActivityIndicator'),
    PanResponder: {
      create: () => ({
        panHandlers: {},
      }),
    },
    Platform: {
      select: (obj: Record<string, unknown>) => obj.default,
    },
    Pressable: ({
      children,
      onPress,
      style,
      testID,
      accessibilityLabel,
      accessibilityRole,
    }: any) =>
      ReactMock.createElement(
        'Pressable',
        { onPress, style, testID, accessibilityLabel, accessibilityRole },
        children,
      ),
    ScrollView: ({ children, ...props }: any) =>
      ReactMock.createElement('ScrollView', props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Text', props, children),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('View', props, children),
    useColorScheme: () => 'light',
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('SafeAreaView', props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleGroupBuys: GroupBuy[] = [
  {
    id: 'gb-cal-1',
    productName: '비건 선크림',
    brandName: 'Sample Beauty',
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth(), 15)
        .toISOString()
        .slice(0, 10) + 'T23:59:59+09:00',
    purchaseUrl: 'https://example.com',
    discountInfo: '20% 할인',
    summary: '민감 피부용 선크림',
    confidence: 0.9,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://instagram.com/p/c1',
      influencer: { instagramUsername: 'beauty_pick' },
    },
  },
  {
    id: 'gb-cal-2',
    productName: '그래놀라 세트',
    brandName: 'Morning Table',
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth(), 15)
        .toISOString()
        .slice(0, 10) + 'T23:59:59+09:00',
    purchaseUrl: 'https://example.com/granola',
    discountInfo: '1+1',
    summary: '아침 식사용 그래놀라',
    confidence: 0.85,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://instagram.com/p/c2',
      influencer: { instagramUsername: 'food_mate' },
    },
  },
  {
    id: 'gb-cal-3',
    productName: '프리미엄 홈트 키트',
    brandName: '핏스타그램',
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5)
        .toISOString()
        .slice(0, 10) + 'T23:59:59+09:00',
    purchaseUrl: 'https://example.com/fitness',
    discountInfo: '25% 할인',
    summary: '홈트레이닝 풀세트',
    confidence: 0.78,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://instagram.com/p/c3',
      influencer: { instagramUsername: 'fitness_guru' },
    },
  },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return (
    node.children
      ?.map((child) => (typeof child === 'string' ? child : flattenText(child)))
      .join(' ') ?? ''
  );
}

function renderCalendar(params: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <CalendarScreen
          navigation={{ navigate: vi.fn(), goBack: vi.fn() } as any}
          route={
            { params, key: 'CalendarScreen', name: 'CalendarScreen' } as any
          }
        />
      </ThemeProvider>,
    );
  });
  return renderer!;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CalendarScreen', () => {
  beforeEach(() => {
    activityMock.bookmarks = [];
    activityMock.notifications = [];
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it('renders the calendar header with current year and month', () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    const now = new Date();
    expect(text).toContain(`${now.getFullYear()}년 ${now.getMonth() + 1}월`);
    expect(text).toContain('오늘');
  });

  it('renders weekday labels in order (월~일)', () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('월');
    expect(text).toContain('화');
    expect(text).toContain('수');
    expect(text).toContain('목');
    expect(text).toContain('금');
    expect(text).toContain('토');
    expect(text).toContain('일');
  });

  it("renders today's date and marks it in the grid", () => {
    const renderer = renderCalendar();
    const today = new Date();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain(String(today.getDate()));
  });

  it('renders navigation arrows and today button', () => {
    const renderer = renderCalendar();
    const pressables = renderer!.root.findAllByType(
      'Pressable' as unknown as React.ElementType,
    );
    const labels = pressables
      .map((p) => p.props.accessibilityLabel)
      .filter(Boolean);
    expect(labels).toContain('이전 달');
    expect(labels).toContain('다음 달');
    expect(labels).toContain('오늘로 이동');
  });

  it('renders activity filters instead of the unavailable following filter', () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('전체 보기');
    expect(text).toContain('북마크');
    expect(text).toContain('알림');
    expect(text).not.toContain('북마크만 보기');
    expect(text).not.toContain('알림만 보기');
    expect(text).not.toContain('둘 다 보기');
    expect(text).not.toContain('✓');
    expect(text).not.toContain('팔로잉');
  });

  it('filters group buys by bookmark and notification combinations', () => {
    const bookmarkedIds = new Set(['gb-cal-1', 'gb-cal-3']);
    const notifiedIds = new Set(['gb-cal-2', 'gb-cal-3']);

    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: false, notified: false },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(['gb-cal-1', 'gb-cal-2', 'gb-cal-3']);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: true, notified: false },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(['gb-cal-1', 'gb-cal-3']);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: false, notified: true },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(['gb-cal-2', 'gb-cal-3']);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: true, notified: true },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(['gb-cal-1', 'gb-cal-2', 'gb-cal-3']);
  });

  it('applies the selected activity filter to the calendar deals', () => {
    const today = new Date();
    const todayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
    ).toISOString();
    const bookmarkDeal = {
      ...sampleGroupBuys[0],
      id: 'gb-filter-bookmark',
      productName: '북마크 전용 공구',
      endDate: todayEnd,
    };
    const notificationDeal = {
      ...sampleGroupBuys[1],
      id: 'gb-filter-notification',
      productName: '알림 전용 공구',
      endDate: todayEnd,
    };
    const bothDeal = {
      ...sampleGroupBuys[2],
      id: 'gb-filter-both',
      productName: '공통 공구',
      endDate: todayEnd,
    };
    mockQueryResult = {
      data: [bookmarkDeal, notificationDeal, bothDeal],
      isFetching: false,
      isError: false,
    };
    activityMock.bookmarks = [{ id: bookmarkDeal.id }, { id: bothDeal.id }];
    activityMock.notifications = [{ groupBuyId: notificationDeal.id }];
    activityMock.notifications.push({ groupBuyId: bothDeal.id });

    const renderer = renderCalendar();
    const bookmarkFilter = renderer!.root.findByProps({
      testID: 'calendar-filter-bookmarked',
    });
    act(() => bookmarkFilter.props.onPress());
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('북마크 전용 공구');
    expect(text).toContain('공통 공구');
    expect(text).not.toContain('알림 전용 공구');

    const notificationFilter = renderer!.root.findByProps({
      testID: 'calendar-filter-notified',
    });
    act(() => notificationFilter.props.onPress());
    const bothText = flattenText(renderer!.toJSON());

    expect(bothText).toContain('북마크 전용 공구');
    expect(bothText).toContain('알림 전용 공구');
    expect(bothText).toContain('공통 공구');
  });

  it('keeps the calendar header fixed while the selected deals scroll', () => {
    const today = new Date();
    mockQueryResult = {
      data: [
        {
          ...sampleGroupBuys[0],
          id: 'gb-scroll-test',
          endDate: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
          ).toISOString(),
        },
      ],
      isFetching: false,
      isError: false,
    };
    const renderer = renderCalendar();
    const header = renderer!.root.findByProps({ testID: 'calendar-header' });
    const dealsScroll = renderer!.root.findByProps({
      testID: 'calendar-deals-scroll',
    });

    expect(header.props.style).toMatchObject({ flexShrink: 0 });
    expect(dealsScroll.props.style).toMatchObject({ flex: 1 });
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it('keeps the calendar grid compact above the selected deals', () => {
    const renderer = renderCalendar();
    const calendarGrid = renderer!.root.findByProps({
      testID: 'calendar-grid',
    });
    const firstDayCell = renderer!.root.findAll(
      (node) => node.props.accessibilityLabel === '1일',
    )[0];

    expect(calendarGrid.props.style).toMatchObject({
      marginBottom: spacing.sm,
      paddingVertical: spacing.xs,
    });
    expect(firstDayCell.props.style[0]).toMatchObject({ minHeight: 40 });
  });

  it('shows empty state when no group buys on selected date', () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('이 날짜의 공구가 없어요');
  });

  it('shows group buys for the selected date when data is available', () => {
    // Mock useQuery to return data with group buys on today's date
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const buysForToday: GroupBuy[] = [
      {
        id: 'gb-today-1',
        productName: '오늘의 딜',
        brandName: '투데이',
        category: 'beauty',
        endDate: todayStr + 'T23:59:59+09:00',
        purchaseUrl: 'https://example.com',
        discountInfo: '30% 할인',
        summary: '오늘만 특가',
        confidence: 0.95,
        startDate: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaType: null,
        rawPost: {
          postUrl: 'https://instagram.com/p/t1',
          influencer: { instagramUsername: 'daily_deal' },
        },
      },
    ];

    // Set mock data
    mockQueryResult = {
      data: buysForToday,
      isFetching: false,
      isError: false,
    };

    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());

    // Should show the deal
    expect(text).toContain('오늘의 딜');
    expect(text).toContain('뷰티');
    expect(text).toContain('@ daily_deal');
    expect(text).toContain('30% 할인');
    expect(text).toContain('오늘의 공구');

    // Reset
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it('opens on the exact initialDate passed from the home weekly strip', () => {
    mockQueryResult = {
      data: [
        {
          id: 'gb-media-test',
          productName: '미디어테스트 20260702T163723Z',
          brandName: null,
          category: 'electronics',
          startDate: '2026-07-02T00:00:00',
          endDate: '2026-07-04T00:00:00',
          purchaseUrl: 'https://example.com/media',
          discountInfo: null,
          summary: null,
          confidence: 0.95,
          thumbnailUrl: null,
          videoUrl: null,
          mediaUrls: [],
          mediaType: null,
          rawPost: {
            postUrl: 'https://instagram.com/p/media',
            influencer: { instagramUsername: 'media_test' },
          },
        },
      ],
      isFetching: false,
      isError: false,
    };

    const renderer = renderCalendar({ initialDate: '2026-07-02' });
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('7월 2일 공구');
    expect(text).toContain('미디어테스트 20260702T163723Z');

    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });
});
