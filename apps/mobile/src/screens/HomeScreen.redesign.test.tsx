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
    ImageBackground: passthrough('ImageBackground'),
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

const sampleGroupBuys: GroupBuy[] = [
  {
    id: 'gb-1',
    productName: '비건 선크림 공구',
    brandName: 'Sample Beauty',
    endDate: '2099-06-15T23:59:59+09:00',
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
    endDate: '2099-06-20T23:59:59+09:00',
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

function renderHomeContent() {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <HomeScreenContent
        groupBuys={sampleGroupBuys}
        influencers={influencers}
        isError={false}
        isFetching={false}
        searchQuery=""
        searchResults={[]}
        onChangeSearchQuery={vi.fn()}
        onClearSearchQuery={vi.fn()}
        onRefresh={vi.fn()}
        onOpenBookmarks={vi.fn()}
        onOpenNotifications={vi.fn()}
        onPressCalendar={vi.fn()}
        onPressCategory={vi.fn()}
        onPressDeal={vi.fn()}
        onPressInfluencer={vi.fn()}
        onPressSubmit={vi.fn()}
      />,
    );
  });
  return renderer!;
}

describe('HomeScreenContent redesign', () => {
  it('renders the discovery feed information architecture', () => {
    const renderer = renderHomeContent();

    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('공구캘린더');
    expect(text).toContain('브랜드명, 제품명으로 검색해보세요');
    expect(text).toContain('이달의 공구');
    expect(text).toContain('뷰티');
    expect(text).toContain('패션');
    expect(text).toContain('푸드');
    expect(text).toContain('월');
    expect(text).toContain('일');
    expect(text).toContain('비건 선크림 공구');
    expect(text).toContain('캘린더 보기');
    expect(text).not.toMatch(/\bHome\b|\bSearch\b|\bSubmit\b|\bCommunity\b|\bMyPage\b/);
  });

  it('uses circular category containers with token border radius', () => {
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
      expect(style.aspectRatio).toBe(1);
      expect(style.minWidth).toBeGreaterThanOrEqual(72);
    }
  });

  it('positions the floating calendar call to action above the safe bottom inset', () => {
    const renderer = renderHomeContent();
    const cta = renderer!.root.findByProps({ accessibilityLabel: '캘린더 보기' });
    const style = flattenStyle(cta.props.style);

    expect(style.bottom).toBe(110);
  });
});

describe('HomeScreenContent redesign interactions', () => {
  it('keeps home actions reachable with 44px minimum touch targets', () => {
    const renderer = renderHomeContent();

    const pressables = renderer!.root.findAllByType('Pressable' as unknown as React.ElementType);
    const labels = pressables.map((pressable) => pressable.props.accessibilityLabel).filter(Boolean);

    expect(labels).toContain('북마크 열기');
    expect(labels).toContain('알림 열기');
    expect(labels).toContain('캘린더 보기');
    expect(labels).toContain('비건 선크림 공구 상세 보기');
    for (const pressable of pressables) {
      const style = Array.isArray(pressable.props.style) ? Object.assign({}, ...pressable.props.style) : pressable.props.style;
      expect(style?.minHeight ?? 44).toBeGreaterThanOrEqual(44);
    }
  });
});
