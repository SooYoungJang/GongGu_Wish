import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { FollowButton } from './FollowButton';
import { SellerRankingList } from './SellerRankingList';
import { SellerRankingRow } from './SellerRankingRow';
import type { SellerRanking } from '../../features/ranking/types';
import { getRankingTrend } from '../../features/ranking/types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement(type, props, children);

  return {
    FlatList: ({ data, renderItem, ItemSeparatorComponent, ListFooterComponent, ...props }: any) =>
      ReactMock.createElement(
        'FlatList',
        props,
        ...(data ?? []).flatMap((item: unknown, index: number) => [
          renderItem({ item, index }),
          ItemSeparatorComponent ? ReactMock.createElement(ItemSeparatorComponent, { key: `separator-${index}` }) : null,
        ]),
        ListFooterComponent,
      ),
    Pressable: ({ children, onPress, style, accessibilityLabel, accessibilityRole, accessibilityState }: any) =>
      ReactMock.createElement('Pressable', { onPress, style, accessibilityLabel, accessibilityRole, accessibilityState }, children),
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    Text: passthrough('Text'),
    View: passthrough('View'),
  };
});

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
    thumbnails: [{ id: 'thumb-1', imageUrl: null, label: '그래놀라', groupBuyId: 'group-1' }],
    representativeGroupBuyId: 'group-1',
    ...overrides,
  };
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

describe('ranking components', () => {
  it('toggles FollowButton visual state through its onFollow prop', () => {
    let following = false;
    const onFollow = vi.fn(() => {
      following = !following;
    });
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <FollowButton isFollowing={following} sellerName="샘플마켓" onFollow={onFollow} />,
      );
    });

    expect(flattenText(renderer!.toJSON())).toContain('팔로우');

    const pressable = renderer!.root.findByType('Pressable' as unknown as React.ElementType);
    act(() => pressable.props.onPress({ stopPropagation: vi.fn() }));
    act(() => {
      renderer!.update(<FollowButton isFollowing={following} sellerName="샘플마켓" onFollow={onFollow} />);
    });

    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(flattenText(renderer!.toJSON())).toContain('팔로잉');
  });

  it('wires seller row follow button to the selected ranking item', () => {
    const item = sampleRanking({ id: 'rank-follow-target', displayName: '팔로우대상' });
    const onToggleFollow = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SellerRankingRow item={item} onPress={vi.fn()} onToggleFollow={onToggleFollow} />,
      );
    });

    const followButton = renderer!.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((pressable) => pressable.props.accessibilityLabel === '팔로우대상 팔로우');

    act(() => followButton!.props.onPress({ stopPropagation: vi.fn() }));

    expect(onToggleFollow).toHaveBeenCalledTimes(1);
    expect(onToggleFollow).toHaveBeenCalledWith(item);
  });

  it('renders ready ranking rows with list accessibility and compact Korean counts', () => {
    const rankings = [sampleRanking({ followerCount: 12300 })];
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SellerRankingList state={{ status: 'ready', data: rankings }} bottomPadding={88} />,
      );
    });

    const flatList = renderer!.root.findByType('FlatList' as unknown as React.ElementType);
    const text = flattenText(renderer!.toJSON());

    expect(flatList.props.accessibilityLabel).toBe('셀러 랭킹 목록');
    expect(text).toContain('샘플마켓');
    expect(text).toContain('팔로워 1.2만');
  });

  it('renders ranking empty state action when rankings are empty', () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SellerRankingList
          state={{ status: 'empty', message: '아직 집계된 랭킹이 없어요', action: { label: '전체 보기', onPress } }}
          bottomPadding={0}
        />,
      );
    });

    const action = renderer!.root.findByProps({ accessibilityLabel: '전체 보기' });
    act(() => action.props.onPress());

    expect(flattenText(renderer!.toJSON())).toContain('아직 집계된 랭킹이 없어요');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
