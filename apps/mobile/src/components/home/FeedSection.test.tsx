import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { FeedSection } from './FeedSection';
import type { FeedPost } from '../../types';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

// Mock react-native
vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: ({ color, size }: { color?: string; size?: string }) =>
      ReactMock.createElement('ActivityIndicator', { color, size }),
    Image: ({ source, style, resizeMode }: any) =>
      ReactMock.createElement('Image', { source, style, resizeMode }),
    Pressable: passthrough('Pressable'),
    ScrollView: ({ children, ...props }: any) =>
      ReactMock.createElement('ScrollView', props, children),
    StyleSheet: {
      absoluteFillObject: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      create: (styles: unknown) => styles,
    },
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Text', props, children),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('View', props, children),
  };
});
vi.mock('../ui/InstagramProfileAvatar', () => ({
  InstagramProfileAvatar: (props: Record<string, unknown>) => {
    const ReactMock = require('react');
    return ReactMock.createElement('InstagramProfileAvatar', props);
  },
}));

vi.mock('../../design/useCommerceTheme', () => ({
  useCommerceTheme: () => ({
    colors: {
      inverse: '#FFFFFF',
      muted: '#6B7280',
      text: '#111827',
    },
  }),
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#F5F0EB',
      surface: '#FFFFFF',
      surfaceHover: '#E8E3DE',
      primary: '#FF7F66',
      primaryBg: '#FFF3ED',
      textPrimary: '#191714',
      textSecondary: '#6E6258',
      textTertiary: '#A99B8F',
      textInverse: '#FFFFFF',
      border: '#DDD4CC',
      borderLight: '#EEE7E0',
      error: '#D84949',
      errorBg: '#FFEAEA',
    },
  }),
}));

const sampleFeedPosts: FeedPost[] = [
  {
    id: 'feed-1',
    instagramUrl: 'https://instagram.com/p/1',
    thumbnailUrl: 'https://example.com/thumb1.jpg',
    mediaUrl: 'https://example.com/media1.jpg',
    mediaType: 'IMAGE',
    caption: '비건 선크림 추천',
    accountName: 'beauty_pick',
    linkUrl: 'https://example.com/deal1',
    openDate: '2026-06-20T00:00:00.000Z',
    closeDate: '2026-07-20T23:59:59.000Z',
    isActive: true,
    sortOrder: 1,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    createdAt: '2026-06-19T10:00:00.000Z',
    updatedAt: '2026-06-19T10:00:00.000Z',
  },
  {
    id: 'feed-2',
    instagramUrl: 'https://instagram.com/p/2',
    thumbnailUrl: null,
    mediaUrl: null,
    mediaType: null,
    caption: '프리미엄 그래놀라 세트',
    accountName: 'food_mate',
    linkUrl: null,
    openDate: null,
    closeDate: null,
    isActive: true,
    sortOrder: 2,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    createdAt: '2026-06-19T11:00:00.000Z',
    updatedAt: '2026-06-19T11:00:00.000Z',
  },
];

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

describe('FeedSection', () => {
  it('renders feed posts in horizontal scroll', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection feedPosts={sampleFeedPosts} onPressFeed={vi.fn()} />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('피드');
    expect(text).toContain('비건 선크림 추천');
    expect(text).toContain('beauty_pick');
    expect(text).toContain('food_mate');
  });

  it('shows empty state when feedPosts is empty', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection feedPosts={[]} onPressFeed={vi.fn()} />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('등록된 피드가 없습니다.');
  });

  it('shows loading state when isLoading is true and no posts', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection feedPosts={[]} onPressFeed={vi.fn()} isLoading={true} />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('피드를 불러오는 중...');
    const spinner = renderer!.root.findByType(
      'ActivityIndicator' as React.ElementType,
    );
    expect(spinner).toBeDefined();
  });

  it('shows error state when isError is true and no posts', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection
          feedPosts={[]}
          onPressFeed={vi.fn()}
          isError={true}
          onRetry={vi.fn()}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('피드를 불러올 수 없습니다.');
    expect(text).toContain('다시 시도');
  });

  it('does not show error state when there are already posts', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection
          feedPosts={sampleFeedPosts}
          onPressFeed={vi.fn()}
          isError={true}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('비건 선크림 추천');
    expect(text).not.toContain('피드를 불러올 수 없습니다.');
  });

  it('does not show loading spinner when there are already posts', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection
          feedPosts={sampleFeedPosts}
          onPressFeed={vi.fn()}
          isLoading={true}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain('비건 선크림 추천');
    expect(text).not.toContain('피드를 불러오는 중...');
  });

  it('calls onPressFeed when a feed card is tapped', () => {
    const onPressFeed = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <FeedSection feedPosts={sampleFeedPosts} onPressFeed={onPressFeed} />,
      );
    });

    const pressables = renderer!.root.findAllByType(
      'Pressable' as unknown as React.ElementType,
    );
    const feedCardPressables = pressables.filter((pressable) =>
      pressable.props.accessibilityLabel?.includes('피드 열기'),
    );
    expect(feedCardPressables.length).toBeGreaterThanOrEqual(1);

    act(() => {
      feedCardPressables[0].props.onPress();
    });
    expect(onPressFeed).toHaveBeenCalledTimes(1);
    expect(onPressFeed).toHaveBeenCalledWith(sampleFeedPosts[0]);
  });

  it('keeps the feed and influencer actions as sibling controls', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <FeedSection feedPosts={[sampleFeedPosts[0]]} onPressFeed={vi.fn()} />,
      );
    });

    const feedAction = renderer!.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((node) => node.props.accessibilityLabel === '비건 선크림 추천 피드 열기')!;

    expect(feedAction).toBeDefined();
    expect(
      renderer!.root.findAllByProps({
        accessibilityLabel: '@beauty_pick 인플루언서 공구 보기',
      }),
    ).not.toHaveLength(0);
    expect(
      feedAction.findAllByProps({
        accessibilityLabel: '@beauty_pick 인플루언서 공구 보기',
      }),
    ).toHaveLength(0);
  });
});
