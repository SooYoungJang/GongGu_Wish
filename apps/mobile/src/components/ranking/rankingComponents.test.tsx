import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { FollowButton } from './FollowButton';
import { RankBadge } from './RankBadge';
import { RankingTrendBadge } from './RankingTrendBadge';
import { SellerRankingList } from './SellerRankingList';
import { SellerRankingRow } from './SellerRankingRow';
import { ThemeProvider } from '../../context/ThemeContext';
import { commerceLightColors, commerceRadius } from '../../design/commerce';
import { spacing } from '../../design/tokens';
import type { SellerRanking } from '../../features/ranking/types';
import { getRankingTrend } from '../../features/ranking/types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  const flatList = ({ data, renderItem, ItemSeparatorComponent, ListFooterComponent, ...props }: any) =>
      ReactMock.createElement(
        'FlatList',
        props,
        ...(data ?? []).flatMap((item: unknown, index: number) => [
          renderItem({ item, index }),
          ItemSeparatorComponent
            ? ReactMock.createElement(ItemSeparatorComponent, {
                key: `separator-${index}`,
              })
            : null,
        ]),
        ListFooterComponent,
      );

  return {
    Animated: { FlatList: flatList },
    FlatList: flatList,
    Pressable: ({ children, ...props }: any) => ReactMock.createElement('Pressable', props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({
      width: 375,
      height: 812,
      scale: 2,
      fontScale: 1,
    }),
    useColorScheme: () => 'light',
    Text: passthrough('Text'),
    View: passthrough('View'),
  };
});

function withTheme(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function sampleRanking(overrides: Partial<SellerRanking> = {}): SellerRanking {
  return {
    id: 'rank-sample',
    sellerId: 'seller-sample',
    rank: 1,
    previousRank: 2,
    trend: getRankingTrend(1, 2),
    displayName: '샘플마켓',
    username: 'sample.market',
    avatarUrl: null,
    category: 'food',
    followerCount: 12300,
    activeDealCount: 7,
    endingSoonCount: 2,
    trustScore: 96,
    isFollowing: false,
    isSponsored: false,
    thumbnails: [
      {
        id: 'thumb-1',
        imageUrl: null,
        label: '그래놀라',
        groupBuyId: 'group-1',
      },
    ],
    representativeGroupBuyId: 'group-1',
    ...overrides,
  };
}

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

describe('ranking components', () => {
  it('renders top-three ranks without leading zeroes', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(withTheme(<RankBadge rank={1} />));
    });

    expect(flattenText(renderer!.toJSON())).toBe('1');
  });

  it('renders ranking trends as color-only directional text', () => {
    const cases: Array<{
      trend: SellerRanking['trend'];
      label: string;
      color: string;
    }> = [
      {
        trend: { kind: 'up', delta: 2 },
        label: '▲2',
        color: commerceLightColors.accent,
      },
      {
        trend: { kind: 'down', delta: 3 },
        label: '▼3',
        color: commerceLightColors.blue,
      },
      { trend: { kind: 'same' }, label: '-', color: commerceLightColors.weak },
    ];

    for (const testCase of cases) {
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(withTheme(<RankingTrendBadge trend={testCase.trend} />));
      });

      const textNode = renderer!.root.findByType('Text' as unknown as React.ElementType);
      const style = flattenStyle(textNode.props.style);

      expect(flattenText(renderer!.toJSON())).toBe(testCase.label);
      expect(style.color).toBe(testCase.color);
      expect(renderer!.root.findAllByType('View' as unknown as React.ElementType)).toHaveLength(0);
    }
  });

  it('toggles FollowButton visual state through its onFollow prop', () => {
    let following = false;
    const onFollow = vi.fn(() => {
      following = !following;
    });
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<FollowButton isFollowing={following} sellerName="샘플마켓" onFollow={onFollow} />),
      );
    });

    expect(renderer!.root.findByProps({ accessibilityLabel: '샘플마켓 알림' })).toBeTruthy();
    expect(renderer!.root.findByProps({ name: 'notifications-outline' })).toBeTruthy();

    const pressable = renderer!.root.findByType('Pressable' as unknown as React.ElementType);
    act(() => pressable.props.onPress());
    act(() => {
      renderer!.update(withTheme(<FollowButton isFollowing={following} sellerName="샘플마켓" onFollow={onFollow} />));
    });

    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findByProps({ accessibilityLabel: '샘플마켓 알림 해제' })).toBeTruthy();
    expect(renderer!.root.findByProps({ name: 'notifications' })).toBeTruthy();
  });

  it('wires seller row follow button to the selected ranking item', () => {
    const item = sampleRanking({
      id: 'rank-follow-target',
      displayName: '팔로우대상',
    });
    const onToggleFollow = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingRow item={item} onPress={vi.fn()} onToggleFollow={onToggleFollow} />),
      );
    });

    const followButton = renderer!.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((pressable) => pressable.props.accessibilityLabel === '팔로우대상 알림');

    act(() => followButton!.props.onPress());

    expect(onToggleFollow).toHaveBeenCalledTimes(1);
    expect(onToggleFollow).toHaveBeenCalledWith(item);
  });

  it('shows the actual popularity metrics instead of a misleading deal count', () => {
    const item = sampleRanking({
      followerCount: 12300,
      activeDealCount: 7,
      trustScore: 96,
    });
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingRow item={item} onPress={vi.fn()} onToggleFollow={vi.fn()} />),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, ' ');
    expect(text).toContain('조회 1.2만');
    expect(text).toContain('저장 7');
    expect(text).toContain('인기지수 96');
    expect(text).not.toContain('공구 7개');
  });

  it('uses soft low-elevation cards for the top three and flat rows from rank four', () => {
    const rankings = [1, 2, 3, 4].map((rank) => sampleRanking({ id: `rank-${rank}`, rank }));
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(withTheme(<SellerRankingList state={{ status: 'ready', data: rankings }} />));
    });

    const first = renderer!.root.findByProps({ testID: 'ranking-row-1' });
    const fourth = renderer!.root.findByProps({ testID: 'ranking-row-4' });
    const firstStyle = flattenStyle(first.props.style);
    const fourthStyle = flattenStyle(fourth.props.style);

    expect(firstStyle.borderRadius).toBe(commerceRadius.sm);
    expect(firstStyle.backgroundColor).toBe(commerceLightColors.panelBg);
    expect(firstStyle.borderWidth).toBeUndefined();
    expect(firstStyle.shadowOpacity).toBeLessThanOrEqual(0.08);
    expect(firstStyle.elevation).toBeLessThanOrEqual(1);
    expect(firstStyle.marginBottom).toBe(spacing.sm);
    expect(fourthStyle.borderRadius).toBeUndefined();
    expect(fourthStyle.borderBottomWidth).toBe(1);
    expect(firstStyle.paddingHorizontal).toBe(fourthStyle.paddingHorizontal);
    expect(first.findAllByProps({ accessibilityLabel: '그래놀라 상세 보기' })).toHaveLength(0);
  });

  it('renders ready ranking rows with list accessibility and compact Korean counts', () => {
    const rankings = [sampleRanking({ followerCount: 12300 })];
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingList state={{ status: 'ready', data: rankings }} bottomPadding={88} />),
      );
    });

    const flatList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, ' ');

    expect(flatList.props.accessibilityLabel).toBe('공구 랭킹 목록');
    expect(flatList.props.showsVerticalScrollIndicator).toBe(false);
    expect(text).toContain('샘플마켓');
    expect(text).toContain('조회');
    expect(text).toContain('저장');
    expect(text).toContain('7');
  });

  it('forwards the shared animated scroll handler to the native list', () => {
    const onScroll = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{ status: 'ready', data: [sampleRanking()] }}
            onScroll={onScroll}
          />,
        ),
      );
    });

    const flatList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    const event = { nativeEvent: { contentOffset: { y: 24 } } };
    act(() => flatList.props.onScroll(event));

    expect(onScroll).toHaveBeenCalledWith(event);
  });

  it('renders ranking empty state action when rankings are empty', () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{
              status: 'empty',
              message: '아직 집계된 랭킹이 없어요',
              action: { label: '전체 보기', onPress },
            }}
            bottomPadding={0}
          />,
        ),
      );
    });

    const action = renderer!.root.findByProps({
      accessibilityLabel: '전체 보기',
    });
    act(() => action.props.onPress());

    expect(flattenText(renderer!.toJSON())).toContain('아직 집계된 랭킹이 없어요');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
