const videoMock = vi.hoisted(() => ({
  players: [] as any[],
}));
const queryMock = vi.hoisted(() => ({
  groupBuys: undefined as any,
}));

vi.mock('expo-video', () => ({
  VideoView: ({ children, ...props }: any) => {
    const ReactMock = require('react');
    return ReactMock.createElement('VideoView', props, children);
  },
  useVideoPlayer: (source: any, setup?: (player: any) => void) => {
    const player = {
      play: vi.fn(),
      pause: vi.fn(),
      replace: vi.fn(),
      loop: false,
      muted: true,
      volume: 0,
      audioMixingMode: 'auto',
      allowsExternalPlayback: true,
      source,
    };
    setup?.(player);
    videoMock.players.push(player);
    return player;
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: queryMock.groupBuys, isLoading: false, isError: false }),
}));

vi.mock('../api', () => ({
  fetchGroupBuys: vi.fn(),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({ data = [], renderItem, keyExtractor, children, ...props }: any) => {
    const ReactMock = require('react');
    return ReactMock.createElement(
      'FlashList',
      props,
      data.map((item: any, index: number) =>
        ReactMock.createElement(
          'FlashListItem',
          { key: keyExtractor ? keyExtractor(item, index) : String(index) },
          renderItem({ item, index }),
        ),
      ),
      children,
    );
  },
}));

import React, { type ReactNode } from 'react';
import { Linking } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DetailScreen } from './DetailScreen';
import type { GroupBuy } from '../types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement(type, props, children);

  return {
    Alert: { alert: vi.fn() },
    Image: ({ source, style, resizeMode, children }: any) =>
      ReactMock.createElement('Image', { source, style, resizeMode }, children as ReactNode),
    Linking: { openURL: vi.fn() },
    Pressable: ({ children, onPress, style, accessibilityLabel, accessibilityRole, pressRetentionOffset }: any) =>
      ReactMock.createElement('Pressable', { onPress, style, accessibilityLabel, accessibilityRole, pressRetentionOffset }, children),
    ScrollView: ({ children, ...props }: any) => ReactMock.createElement('ScrollView', props, children),
    Share: { share: vi.fn() },
    StatusBar: ({ ...props }: any) => ReactMock.createElement('StatusBar', props),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough('Text'),
    View: passthrough('View'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  };
});

vi.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('SafeAreaView', props, children),
    useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 34, left: 0 }),
  };
});

vi.mock('../components/AppButton', () => ({
  AppButton: ({ children, onPress, variant, style, disabled }: any) => {
    const ReactMock = require('react');
    return ReactMock.createElement('Pressable', { onPress, style, variant, disabled }, children);
  },
}));

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

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

const baseGroupBuy: GroupBuy = {
  id: 'group-buy-1',
  productName: '퍼스트 바이크',
  brandName: '퍼스트',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  purchaseUrl: 'https://example.com/buy',
  discountInfo: '최대 20% 할인',
  summary: '대표 요약',
  confidence: 0.95,
  thumbnailUrl: 'https://example.com/thumb.jpg',
  videoUrl: null,
  mediaUrls: [
    'https://example.com/slide-1.jpg',
    'https://example.com/slide-2.jpg',
    'https://example.com/slide-3.jpg',
  ],
  mediaType: 'IMAGE',
  rawPost: {
    postUrl: 'https://instagram.com/p/example',
    influencer: {
      instagramUsername: 'hanssang_home',
    },
  },
};

beforeEach(() => {
  videoMock.players = [];
  queryMock.groupBuys = undefined;
});

describe('DetailScreen', () => {
  it('renders every media slide in a paging gallery', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{} as any}
        />,
      );
    });

    const mediaScroll = renderer!.root.findAll((node) => String(node.type) === 'FlashList').find((node) => node.props.horizontal);
    const images = renderer!.root.findAll((node) => String(node.type) === 'Image');
    const text = flattenText(renderer!.toJSON());

    expect(mediaScroll?.props.pagingEnabled).toBe(true);
    expect(images).toHaveLength(3);
    expect(text).toContain('릴스');
    expect(text).toContain('구매 링크 열기');
    expect(text).not.toContain('팔로우');
  });

  it('renders each typed media item as image or video when carousel media is mixed', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      videoUrl: 'https://cdn.example.com/slide-2-video.mp4',
      mediaUrls: [
        'https://cdn.example.com/slide-1.jpg',
        'https://cdn.example.com/slide-2-video.mp4',
        'https://cdn.example.com/slide-3.jpg',
      ],
      mediaItems: [
        { url: 'https://cdn.example.com/slide-1.jpg', mediaType: 'IMAGE', thumbnailUrl: 'https://cdn.example.com/slide-1.jpg' },
        { url: 'https://cdn.example.com/slide-2-video.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://cdn.example.com/slide-2-cover.jpg' },
        { url: 'https://cdn.example.com/slide-3.jpg', mediaType: 'IMAGE', thumbnailUrl: 'https://cdn.example.com/slide-3.jpg' },
      ],
      mediaType: 'VIDEO',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const horizontalList = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.horizontal);
    expect(renderer!.root.findAll((node) => String(node.type) === 'VideoView')).toHaveLength(0);

    act(() => {
      horizontalList?.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 390 } } });
    });

    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    expect(videoViews).toHaveLength(1);
    expect(videoViews[0]?.props.contentFit).toBe('contain');
    expect(videoMock.players[0]?.source).toEqual({
      uri: 'https://cdn.example.com/slide-2-video.mp4',
      contentType: 'auto',
    });
  });

  it('falls back to thumbnail when mediaUrls is empty', () => {
    const groupBuy = {
      ...baseGroupBuy,
      mediaUrls: [],
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{} as any}
        />,
      );
    });

    const images = renderer!.root.findAll((node) => String(node.type) === 'Image');
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual({ uri: 'https://example.com/thumb.jpg' });
  });

  it('renders fetched products as vertical reel pages after the selected product', () => {
    const nextGroupBuy: GroupBuy = {
      ...baseGroupBuy,
      id: 'group-buy-2',
      productName: '다음 공구',
      thumbnailUrl: 'https://example.com/next.jpg',
      mediaUrls: ['https://example.com/next.jpg'],
      rawPost: {
        postUrl: 'https://instagram.com/p/next',
        influencer: {
          instagramUsername: 'next_seller',
        },
      },
    };
    queryMock.groupBuys = [baseGroupBuy, nextGroupBuy];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const verticalScroll = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.pagingEnabled && !node.props.horizontal);
    const text = flattenText(renderer!.toJSON());

    expect(verticalScroll).toBeDefined();
    expect(text).toContain('퍼스트 바이크');
    expect(text).toContain('다음 공구');
  });

  it('opens and closes the summary bottom sheet from the reel preview', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: '저희집에 놀러온 지인이 보자마자 물어본 제품입니다.\n\n긴 설명도 시트에서 잘 보여야 합니다.',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    const verticalListWhileOpen = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.pagingEnabled && !node.props.horizontal);
    const raisedMediaStage = renderer!.root
      .findAll((node) => String(node.type) === 'View')
      .find((node) => JSON.stringify(node.props.style).includes('"borderRadius":22'));

    expect(verticalListWhileOpen?.props.scrollEnabled).toBe(false);
    expect(raisedMediaStage).toBeDefined();
    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
    expect(flattenText(renderer!.toJSON())).toContain('긴 설명도 시트에서 잘 보여야 합니다.');
    expect(flattenText(renderer!.toJSON())).toContain('구매링크');
    expect(
      renderer!.root.find(
        (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 창 닫기',
      ),
    ).toBeDefined();

    const closeButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 창 닫기',
    );
    const purchaseButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '구매 링크 열기',
    )[0];

    act(() => {
      purchaseButton?.props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/buy');

    act(() => {
      closeButton.props.onPress();
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('only re-enables vertical reel swiping when the summary sheet scroll reaches an edge', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');

    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
      scrollView.props.onContentSizeChange(0, 360);
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    });

    const verticalListInMiddle = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.pagingEnabled && !node.props.horizontal);
    expect(verticalListInMiddle?.props.scrollEnabled).toBe(false);

    act(() => {
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 260 } } });
    });

   const verticalListAtBottom = renderer!.root
     .findAll((node) => String(node.type) === 'FlashList')
     .find((node) => node.props.pagingEnabled && !node.props.horizontal);
   expect(verticalListAtBottom?.props.scrollEnabled).toBe(true);
 });

  it('dismisses the summary sheet when dragged down at the top of the scroll', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');

    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
      scrollView.props.onContentSizeChange(0, 360);
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);

    act(() => {
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    });

    act(() => {
      scrollView.props.onScrollEndDrag({
        nativeEvent: { contentOffset: { y: 0 }, velocity: { y: 1.2 } },
      });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('dismisses the summary sheet when content is shorter than the viewport', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: '짧은 한 줄 요약입니다.',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');

    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 200 } } });
      scrollView.props.onContentSizeChange(0, 80);
    });

    act(() => {
      scrollView.props.onScrollEndDrag({
        nativeEvent: { contentOffset: { y: 0 }, velocity: { y: 0.8 } },
      });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('does not mount video players for inactive product pages', () => {
    const nextVideoGroupBuy: GroupBuy = {
      ...baseGroupBuy,
      id: 'group-buy-video-next',
      productName: '다음 영상 공구',
      thumbnailUrl: 'https://example.com/next-thumb.jpg',
      videoUrl: 'https://example.com/next-video.mp4',
      mediaUrls: ['https://example.com/next-video.mp4'],
      mediaType: 'VIDEO',
    };
    queryMock.groupBuys = [baseGroupBuy, nextVideoGroupBuy];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ goBack: vi.fn() } as any}
        />,
      );
    });

    const verticalList = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.pagingEnabled && !node.props.horizontal);
    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');

    expect(verticalList?.props.drawDistance).toBe(844);
    expect(verticalList?.props.maxItemsInRecyclePool).toBe(2);
    expect(verticalList?.props.maintainVisibleContentPosition).toEqual({ disabled: true });
    expect(videoViews).toHaveLength(0);
    expect(videoMock.players).toHaveLength(0);
  });
});

describe('DetailScreen video playback', () => {
  it('renders VideoView for videoUrl even when the URL has no video extension', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      videoUrl: 'https://cdn.example.com/media-test?id=abc123',
      mediaUrls: ['https://example.com/slide-1.jpg'],
      mediaType: 'VIDEO',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{} as any}
        />,
      );
    });

    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    const images = renderer!.root.findAll((node) => String(node.type) === 'Image');
    expect(videoViews).toHaveLength(1);
    expect(images).toHaveLength(1);
    expect(videoViews[0]?.props.contentFit).toBe('contain');
    expect(videoViews[0]?.props.pointerEvents).toBe('none');
    expect(videoMock.players[0]?.source).toEqual({
      uri: 'https://cdn.example.com/media-test?id=abc123',
      contentType: 'auto',
    });
    expect(videoMock.players[0]?.muted).toBe(false);
    expect(videoMock.players[0]?.volume).toBe(1);
    expect(videoMock.players[0]?.audioMixingMode).toBe('doNotMix');
    expect(videoMock.players[0]?.play).toHaveBeenCalled();
  });

  it('toggles video playback when the video is tapped', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      videoUrl: 'https://example.com/reel.mp4',
      mediaUrls: ['https://example.com/reel.mp4'],
      mediaType: 'VIDEO',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{} as any}
        />,
      );
    });

    const getTotalPlayCalls = () => videoMock.players.reduce((sum, item) => sum + item.play.mock.calls.length, 0);
    const getTotalPauseCalls = () => videoMock.players.reduce((sum, item) => sum + item.pause.mock.calls.length, 0);
    const pauseButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '동영상 일시정지',
    );
    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');

    expect(videoViews).toHaveLength(1);
    expect(pauseButton.props.pressRetentionOffset).toBe(24);
    const pauseCallsBeforeTap = getTotalPauseCalls();

    act(() => {
      pauseButton.props.onPress();
    });

    expect(getTotalPauseCalls()).toBeGreaterThan(pauseCallsBeforeTap);
    const player = videoMock.players[videoMock.players.length - 1];
    expect(player.muted).toBe(false);
    expect(player.volume).toBe(1);
    expect(player.audioMixingMode).toBe('doNotMix');
    const playCallsAfterPause = getTotalPlayCalls();

    const playButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '동영상 재생',
    );

    act(() => {
      playButton.props.onPress();
    });

    expect(getTotalPlayCalls()).toBeGreaterThan(playCallsAfterPause);
  });
});
