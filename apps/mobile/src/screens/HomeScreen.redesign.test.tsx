import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { HomeScreenContent } from './HomeScreen';
import type { GroupBuy, Influencer } from '../types';

vi.mock('../api', () => ({
  fallbackGroupBuys: [],
  fetchGroupBuys: vi.fn(),
  fetchInfluencers: vi.fn(),
  searchInfluencers: (influencers: Influencer[], query: string) =>
    influencers.filter((influencer) => influencer.instagramUsername.includes(query)),
}));

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough('ActivityIndicator'),
    FlatList: ({ data, renderItem, ListHeaderComponent, ...props }: any) =>
      ReactMock.createElement(
        'FlatList',
        props,
        ListHeaderComponent,
        ...(data ?? []).map((item: unknown, index: number) => renderItem({ item, index })),
      ),
    Image: passthrough('Image'),
    ImageBackground: passthrough('ImageBackground'),
    Keyboard: {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Pressable: ({ children, onPress, style, testID, accessibilityLabel, accessibilityRole }: any) =>
      ReactMock.createElement('Pressable', { onPress, style, testID, accessibilityLabel, accessibilityRole }, children),
    RefreshControl: passthrough('RefreshControl'),
    ScrollView: ({ children, ...props }: any) => ReactMock.createElement('ScrollView', props, children),
    StatusBar: passthrough('StatusBar'),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement('Text', props, children),
    TextInput: (props: any) => ReactMock.createElement('TextInput', props, props.placeholder),
    View: ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement('View', props, children),
  };
});

vi.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement('SafeAreaView', props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    themeMode: 'system',
    setThemeMode: () => {},
    toggleTheme: () => {},
    colors: {
      bg: '#FFFFFF',
      surface: '#F8F9FA',
      surfaceHover: '#F0F1F3',
      primary: '#007AFF',
      primaryBg: '#E8F0FE',
      textPrimary: '#1A1A2E',
      textSecondary: '#4A4A5A',
      textTertiary: '#8E8E98',
      textInverse: '#FFFFFF',
      noticeText: '#333333',
      warningBg: '#FFF8E1',
      error: '#FF3B30',
      errorBg: '#FFEBEE',
      border: '#E5E5EA',
      borderLight: '#F0F0F5',
      shadow: '#000000',
      divider: '#E0E0E0',
      ctaPurple: '#6C63FF',
      ctaPurpleText: '#FFFFFF',
    } as any,
    shadows: {} as any,
  }),
}));

function dateStr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 59, 0);
  // Offset to KST (+09:00)
  const kstOffset = 9 * 60;
  const localOffset = d.getTimezoneOffset();
  const kstTime = d.getTime() + (localOffset + kstOffset) * 60_000;
  return new Date(kstTime).toISOString().replace('.000', '');
}

const sampleGroupBuys: GroupBuy[] = [
  {
    id: 'gb-1',
    productName: '비건 선크림 공구',
    brandName: 'Sample Beauty',
    endDate: dateStr(2),
    purchaseUrl: 'https://example.com',
    discountInfo: '20% 할인',
    summary: '민감 피부를 위한 촉촉한 선크림 공구입니다.',
    confidence: 0.93,
    rawPost: { postUrl: 'https://instagram.com/p/1', influencer: { instagramUsername: 'beauty_pick' } },
  },
  {
    id: 'gb-2',
    productName: '프리미엄 그래놀라 세트',
    brandName: 'Morning Table',
    endDate: dateStr(5),
    purchaseUrl: 'https://example.com/granola',
    discountInfo: '1+1 구성',
    summary: '아침 식사용 그래놀라 공동구매입니다.',
    confidence: 0.88,
    rawPost: { postUrl: 'https://instagram.com/p/2', influencer: { instagramUsername: 'food_mate' } },
  },
];

const influencers: Influencer[] = [
  { id: 'inf-1', instagramUsername: 'beauty_pick', displayName: '뷰티픽', isActive: true },
];

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

function renderHomeContent(props: Partial<React.ComponentProps<typeof HomeScreenContent>> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <HomeScreenContent
        groupBuys={sampleGroupBuys}
        feedPosts={[]}
        influencers={influencers}
        isError={false}
        isFetching={false}
        onRefresh={vi.fn()}
        onOpenBookmarks={vi.fn()}
        onOpenNotifications={vi.fn()}
        onOpenSearch={vi.fn()}
        onPressCalendar={vi.fn()}
        onPressCategory={vi.fn()}
        onPressDeal={vi.fn()}
        onPressFeed={vi.fn()}
        onPressInfluencer={vi.fn()}
        onPressSubmit={vi.fn()}
        feedsLoading={false}
        feedsError={false}
        onRetryFeed={vi.fn()}
        {...props}
      />,
    );
  });
  return renderer!;
}

describe('HomeScreenContent redesign', () => {
  it('renders the discovery feed information architecture', () => {
    const renderer = renderHomeContent();

    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('공구위시');
    expect(text).toContain('이달의 공구');
    expect(text).toContain('뷰티');
    expect(text).toContain('패션');
    expect(text).toContain('푸드');
    expect(text).toContain('월');
    expect(text).toContain('일');
    expect(text).toContain('비건 선크림 공구');
    expect(text).toContain('전체');
    expect(text).not.toMatch(/\bHome\b|\bSearch\b|\bSubmit\b|\bCommunity\b|\bMyPage\b/);
  });

  it('uses horizontal pill category containers with token border radius', () => {
    const renderer = renderHomeContent();
    const categoryLabels = ['뷰티', '패션', '푸드', '라이프', '육아', '디지털'];
    const pressables = renderer!.root.findAllByType('Pressable' as unknown as React.ElementType);
    const categoryPressables = pressables.filter(
      (pressable) => typeof pressable.props.accessibilityLabel === 'string' && pressable.props.accessibilityLabel.endsWith('카테고리 보기'),
    );

    expect(categoryPressables).toHaveLength(categoryLabels.length);

    for (const pressable of categoryPressables) {
      const style = flattenStyle(pressable.props.style);
      expect(style.borderRadius).toBe(999);
      expect(style.flexDirection).toBe('row');
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('renders the calendar header with 이번주 공구 title and 전체 textLink', () => {
    const renderer = renderHomeContent();
    const viewAllCta = renderer!.root.findByProps({ accessibilityLabel: '전체 캘린더 보기' });
    expect(viewAllCta).toBeDefined();

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('이번주 공구');
    expect(text).toContain('전체');
  });

  it('shows network-notice fallback copy, not local-API copy', () => {
    const renderer = renderHomeContent({ isError: true });
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('네트워크 연결 상태를 확인해주세요.');
    expect(text).not.toContain('로컬 API');
  });
});

describe('HomeScreenContent redesign v2', () => {
  it('shows 이번주 공구 instead of 주간 공구', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    expect(text).not.toContain('주간 공구');
    expect(text).toContain('이번주 공구');
  });

  it('renders calendar 전체 as textLink without border', () => {
    const renderer = renderHomeContent();
    const viewAllCta = renderer!.root.findByProps({ accessibilityLabel: '전체 캘린더 보기' });
    const style = flattenStyle(viewAllCta.props.style);
    expect(String(style.borderWidth)).toBe('0');
  });

  it('removes DISCOVERY FEED eyebrow and 오늘 열려있는 공구 section', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    expect(text).not.toContain('DISCOVERY FEED');
    expect(text).not.toContain('오늘 열려있는 공구');
  });

  it('renders 마감임박 공구 section with 전체보기 action', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('마감임박 공구');
    expect(text).toContain('전체보기');
  });
});

describe('HomeScreenContent redesign interactions', () => {
  it('keeps home actions reachable with 44px minimum touch targets', () => {
    const renderer = renderHomeContent();

    const pressables = renderer!.root.findAllByType('Pressable' as unknown as React.ElementType);
    const labels = pressables.map((pressable) => pressable.props.accessibilityLabel).filter(Boolean);

    expect(labels).toContain('북마크 열기');
    expect(labels).toContain('알림 열기');
    expect(labels).toContain('전체 캘린더 보기');
    expect(labels).toContain('비건 선크림 공구 상세 보기');
    for (const pressable of pressables) {
      const style = Array.isArray(pressable.props.style) ? Object.assign({}, ...pressable.props.style) : pressable.props.style;
      expect(style?.minHeight ?? 44).toBeGreaterThanOrEqual(44);
    }
  });
});
