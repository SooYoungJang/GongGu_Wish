import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreScreen } from './StoreScreen';
import { ThemeProvider } from '../context/ThemeContext';
import { spacing } from '../design/tokens';
import type { SellerRanking } from '../features/ranking/types';

const ranking: SellerRanking = {
  id: 'rank-1',
  sellerId: 'group-1',
  rank: 1,
  previousRank: 2,
  trend: { kind: 'up', delta: 1 },
  displayName: '여름 한정 공구',
  username: 'summer.market',
  avatarUrl: null,
  category: 'living',
  followerCount: 12000,
  activeDealCount: 83,
  trustScore: 91,
  isFollowing: false,
  isSponsored: false,
  thumbnails: [{ id: 'thumb-1', imageUrl: null, groupBuyId: 'group-1' }],
  representativeGroupBuyId: 'group-1',
};

const refreshRanking = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    interpolate(config: { inputRange: number[]; outputRange: number[]; extrapolate?: string }) {
      return {
        ...config,
        __getValue: () => {
          const [inputStart, inputEnd] = config.inputRange;
          const [outputStart, outputEnd] = config.outputRange;
          const clamped = Math.min(inputEnd, Math.max(inputStart, this.value));
          const progress = inputEnd === inputStart ? 0 : (clamped - inputStart) / (inputEnd - inputStart);
          return outputStart + (outputEnd - outputStart) * progress;
        },
      };
    }
  }

  const flatList = ({ data, renderItem, ListFooterComponent, ...props }: any) =>
    ReactMock.createElement(
      'FlatList',
      props,
      ...(data ?? []).map((item: unknown, index: number) => renderItem({ item, index })),
      ListFooterComponent,
    );

  return {
    ActivityIndicator: passthrough('ActivityIndicator'),
    Alert: { alert: vi.fn() },
    Animated: {
      FlatList: flatList,
      Value: AnimatedValue,
      View: passthrough('AnimatedView'),
      event: vi.fn((mapping: any[]) => {
        const value = mapping[0].nativeEvent.contentOffset.y as AnimatedValue;
        return (event: { nativeEvent: { contentOffset: { y: number } } }) => {
          value.value = event.nativeEvent.contentOffset.y;
        };
      }),
      timing: vi.fn((value: AnimatedValue, config: { toValue: number }) => ({
        start: () => {
          value.value = config.toValue;
        },
      })),
    },
    FlatList: flatList,
    Image: passthrough('Image'),
    Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? ReactMock.createElement('Modal', props, children) : null,
    Pressable: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Pressable', props, children),
    ScrollView: passthrough('ScrollView'),
    StyleSheet: { absoluteFillObject: {}, create: (styles: unknown) => styles },
    Text: passthrough('Text'),
    View: passthrough('View'),
    useColorScheme: () => 'light',
    useWindowDimensions: () => ({
      width: 375,
      height: 812,
      scale: 2,
      fontScale: 1,
    }),
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

vi.mock('../features/ranking/usePopularGroupBuys', () => ({
  usePopularGroupBuys: () => ({
    status: 'ready',
    data: [ranking],
    refreshing: false,
    updatedAt: Date.now(),
    refresh: refreshRanking,
  }),
}));

vi.mock('../hooks/useLocalDeals', () => ({
  useNotifications: () => ({
    isNotifying: () => false,
    toggleNotification: vi.fn(),
  }),
}));

vi.mock('../api', () => ({ syncNotification: vi.fn() }));

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }

  return style && typeof style === 'object' ? (style as Record<string, unknown>) : {};
}

function getTranslateY(style: unknown): { __getValue: () => number } {
  const transform = flattenStyle(style).transform as Array<{
    translateY: { __getValue: () => number };
  }>;
  return transform[0].translateY;
}

function createNavigation() {
  let tabPressListener: (() => void) | undefined;
  return {
    navigate: vi.fn(),
    addListener: vi.fn((_eventName: string, listener: () => void) => {
      tabPressListener = listener;
      return vi.fn();
    }),
    isFocused: vi.fn(() => true),
    emitTabPress: () => tabPressListener?.(),
  };
}

describe('StoreScreen ranking redesign', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows the clean ranking header and removes the non-functional global alert action', () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen navigation={navigation as never} route={{ key: 'Store-test', name: 'Store' } as never} />
        </ThemeProvider>,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, ' ');
    const pressables = renderer!.root.findAllByType('Pressable' as unknown as React.ElementType);
    expect(text).not.toContain('사람들이 많이 찾고 저장한 공구를 모았어요');
    expect(text).not.toContain('업데이트');
    expect(text).not.toContain('전체 랭킹');
    expect(pressables.filter((item) => item.props.accessibilityLabel === '랭킹 검색')).toHaveLength(1);
    expect(pressables.filter((item) => item.props.accessibilityLabel === '랭킹 알림')).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ name: 'search-outline' })).toHaveLength(1);
  });

  it('scrolls period and sort filters away while keeping the category filter pinned', () => {
    vi.useFakeTimers();
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen navigation={navigation as never} route={{ key: 'Store-test', name: 'Store' } as never} />
        </ThemeProvider>,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'ranking-collapsible-filters' }).props.onLayout({
        nativeEvent: { layout: { height: 90, width: 375, x: 0, y: 0 } },
      });
      renderer!.root.findByProps({ testID: 'ranking-category-filter' }).props.onLayout({
        nativeEvent: { layout: { height: 52, width: 375, x: 0, y: 0 } },
      });
    });

    const collapsible = renderer!.root.findByProps({ testID: 'ranking-collapsible-filters' });
    const category = renderer!.root.findByProps({ testID: 'ranking-category-filter' });
    const clip = renderer!.root.findByProps({ testID: 'ranking-scroll-clip' });
    const flatList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    const collapsibleTranslate = getTranslateY(collapsible.props.style);
    const categoryTranslate = getTranslateY(category.props.style);

    expect(flattenStyle(clip.props.style).overflow).toBe('hidden');
    expect(collapsible.findAllByProps({ accessibilityLabel: '인기 공구 정렬' }).length).toBeGreaterThan(0);
    expect(collapsible.findAllByProps({ accessibilityLabel: '카테고리 전체 선택' })).toHaveLength(0);
    expect(category.findAllByProps({ accessibilityLabel: '카테고리 전체 선택' }).length).toBeGreaterThan(0);
    expect(category.findAllByProps({ accessibilityLabel: '인기 공구 정렬' })).toHaveLength(0);
    expect(collapsibleTranslate.__getValue()).toBe(0);
    expect(categoryTranslate.__getValue()).toBe(90);

    act(() => flatList.props.onScroll({ nativeEvent: { contentOffset: { y: 90 } } }));
    expect(collapsibleTranslate.__getValue()).toBe(-90);
    expect(categoryTranslate.__getValue()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(collapsibleTranslate.__getValue()).toBe(-90);
    expect(categoryTranslate.__getValue()).toBe(0);

    act(() => flatList.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(collapsibleTranslate.__getValue()).toBe(0);
    expect(categoryTranslate.__getValue()).toBe(90);
    expect(Animated.event).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ useNativeDriver: true }),
    );
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it('keeps the list inset stable while the two filter layers move', () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen navigation={navigation as never} route={{ key: 'Store-test', name: 'Store' } as never} />
        </ThemeProvider>,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'ranking-collapsible-filters' }).props.onLayout({
        nativeEvent: { layout: { height: 90, width: 375, x: 0, y: 0 } },
      });
      renderer!.root.findByProps({ testID: 'ranking-category-filter' }).props.onLayout({
        nativeEvent: { layout: { height: 52, width: 375, x: 0, y: 0 } },
      });
    });

    const initialList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    const initialTopInset = flattenStyle(initialList.props.contentContainerStyle).paddingTop;
    expect(initialTopInset).toBe(90 + 52 + spacing.sm);

    act(() => initialList.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } }));
    const hiddenList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    expect(flattenStyle(hiddenList.props.contentContainerStyle).paddingTop).toBe(initialTopInset);
  });

  it('refreshes the ranking when its active GNB tab is pressed again', () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen navigation={navigation as never} route={{ key: 'Store-test', name: 'Store' } as never} />
        </ThemeProvider>,
      );
    });

    const flatList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    expect(flatList.props.onRefresh).toBe(refreshRanking);

    act(() => navigation.emitTabPress());

    expect(refreshRanking).toHaveBeenCalledTimes(1);
  });
});
