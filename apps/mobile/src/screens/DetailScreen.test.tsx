const videoMock = vi.hoisted(() => ({
  players: [] as any[],
  deferReplaceAsync: false,
  replaceAsyncResolvers: [] as Array<() => void>,
}));
const queryMock = vi.hoisted(() => ({
  groupBuys: undefined as any,
}));
vi.mock('../hooks/useLocalDeals', () => ({
  useBookmarks: () => ({ bookmarks: [], isBookmarked: () => false, toggleBookmark: vi.fn(), ready: true }),
  useRecentViews: () => ({ recentViews: [], recordView: vi.fn(), ready: true }),
  useNotifications: () => ({ notifications: [], isNotifying: () => false, toggleNotification: vi.fn(), ready: true }),
}));
const flashListMock = vi.hoisted(() => ({
  scrollToOffset: vi.fn(),
}));
const pagerViewMock = vi.hoisted(() => ({
  setPage: vi.fn(),
  setPageWithoutAnimation: vi.fn(),
}));

vi.mock('expo-video', () => ({
  VideoView: ({ children, ...props }: any) => {
    const ReactMock = require('react');
    return ReactMock.createElement('VideoView', props, children);
  },
  useVideoPlayer: (source: any, setup?: any) => {
    const player = {
      play: vi.fn(),
      pause: vi.fn(),
      replace: vi.fn(),
      replaceAsync: vi.fn((nextSource: any) => {
        if (videoMock.deferReplaceAsync) {
          return new Promise<void>((resolve) => {
            videoMock.replaceAsyncResolvers.push(() => {
              player.source = nextSource;
              resolve();
            });
          });
        }
        player.source = nextSource;
        return Promise.resolve();
      }),
      loop: false,
      muted: true,
      volume: 0,
      audioMixingMode: 'auto',
      allowsExternalPlayback: true,
      currentTime: 12,
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

vi.mock('@shopify/flash-list', () => {
  const ReactMock = require('react');

  return {
    FlashList: ReactMock.forwardRef(({ data = [], renderItem, keyExtractor, children, ...props }: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({
        scrollToOffset: flashListMock.scrollToOffset,
      }));

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
    }),
  };
});

vi.mock('react-native-pager-view', () => {
  const ReactMock = require('react');

  const PagerView = ReactMock.forwardRef(({ children, ...props }: any, ref: any) => {
    ReactMock.useImperativeHandle(ref, () => ({
      setPage: pagerViewMock.setPage,
      setPageWithoutAnimation: pagerViewMock.setPageWithoutAnimation,
    }));

    return ReactMock.createElement('PagerView', props, children);
  });

  return {
    default: PagerView,
  };
});

import React, { type ReactNode } from 'react';
import { Alert, Animated, Linking } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DetailScreen, ReelVideoPreloader } from './DetailScreen';
import { spacing } from '../design/tokens';
import type { GroupBuy } from '../types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement(type, props, children);

  return {
    Alert: { alert: vi.fn() },
    BackHandler: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      exitApp: vi.fn(),
    },
    Animated: {
      Value: function AnimatedValue(this: any, value: number) {
        this._listeners = new Map();
        this._value = value;
        this.stopAnimation = vi.fn();
        this.setValue = vi.fn((nextValue: number) => {
          this._value = nextValue;
          this._listeners.forEach((listener: any) => {
            listener({ value: nextValue });
          });
        });
        this.addListener = vi.fn((listener: any) => {
          const id = String(this._listeners.size + 1);
          this._listeners.set(id, listener);
          return id;
        });
        this.removeListener = vi.fn((id: string) => {
          this._listeners.delete(id);
        });
        this.interpolate = vi.fn(() => {
          // Return a chainable interpolation-like object so multiple
          // interpolate calls (sheetProgress -> width/height/etc.) work.
          const chainable = {
            interpolate: vi.fn(() => chainable),
            addListener: vi.fn(() => '1'),
            removeListener: vi.fn(),
            setValue: vi.fn(),
            stopAnimation: vi.fn(),
          };
          return chainable;
        });
      },
      spring: vi.fn((value: any, config: any) => ({
        start: (cb?: () => void) => {
          value?.setValue?.(config.toValue);
          cb?.();
        },
        stop: vi.fn(),
      })),
      timing: vi.fn((value: any, config: any) => ({
        start: (cb?: () => void) => {
          value?.setValue?.(config.toValue);
          cb?.();
        },
        stop: vi.fn(),
      })),
      View: passthrough('Animated.View'),
    },
    PanResponder: {
      create: vi.fn((handlers: any) => ({ panHandlers: handlers })),
    },
    Platform: { OS: 'ios' },
    Easing: {
      out: vi.fn((fn: any) => fn),
      cubic: vi.fn(),
      inOut: vi.fn((fn: any) => fn),
      sin: vi.fn(),
    },
    Image: ({ source, style, resizeMode, children }: any) =>
      ReactMock.createElement('Image', { source, style, resizeMode }, children as ReactNode),
    Linking: { openURL: vi.fn() },
    Keyboard: { dismiss: vi.fn() },
    FlatList: ReactMock.forwardRef(({ data = [], renderItem, keyExtractor, children, ...props }: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({
        scrollToOffset: flashListMock.scrollToOffset,
      }));

      return ReactMock.createElement(
        'FlatList',
        props,
        data.map((item: any, index: number) =>
          ReactMock.createElement(
            'FlatListItem',
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem({ item, index }),
          ),
        ),
        children,
      );
    }),
    Pressable: ({ children, onPress, style, accessibilityLabel, accessibilityRole, pressRetentionOffset }: any) =>
      ReactMock.createElement('Pressable', { onPress, style, accessibilityLabel, accessibilityRole, pressRetentionOffset }, children),
    ScrollView: ({ children, ...props }: any) => ReactMock.createElement('ScrollView', props, children),
    Share: { share: vi.fn() },
    StatusBar: ({ ...props }: any) => ReactMock.createElement('StatusBar', props),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough('Text'),
    TextInput: passthrough('TextInput'),
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

function findVerticalPager(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.find((node) => String(node.type) === 'PagerView');
}

function findSummaryScrollGesture(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => String(node.type) === 'GestureDetector')
    .map((node) => node.props.gesture.__handlers)
    .find((handlers) => handlers.activeOffsetY === 4);
}

function findSummarySheetPanGesture(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => String(node.type) === 'GestureDetector')
    .map((node) => node.props.gesture.__handlers)
    .find((handlers) => handlers.activeOffsetY === 6);
}

function flattenStyle(style: any): any[] {
  if (!Array.isArray(style)) return [style].filter(Boolean);
  return style.flatMap(flattenStyle).filter(Boolean);
}

function getTransformValue(styles: any[], key: string) {
  for (const style of styles) {
    const transform = style?.transform;
    if (!Array.isArray(transform)) continue;
    const entry = transform.find((item: Record<string, number>) => item[key] !== undefined);
    if (entry) return entry[key];
  }
  return undefined;
}

function getStyleValue(styles: any[], key: string) {
  for (const style of styles) {
    if (style?.[key] !== undefined) return style[key];
  }
  return undefined;
}

function getMediaStageFrame(renderer: TestRenderer.ReactTestRenderer) {
  const animatedViews = renderer.root.findAll((node) => String(node.type) === 'Reanimated.View');
  const frameNode = animatedViews.find((node) => {
    const styles = flattenStyle(node.props.style);
    return styles.some((style) => style?.backgroundColor === '#05070A' && style?.overflow === 'hidden')
      && getStyleValue(styles, 'height') !== undefined
      && getStyleValue(styles, 'width') !== undefined;
  });
  const contentNode = animatedViews.find((node) => {
    const styles = flattenStyle(node.props.style);
    return styles.some((style) => style?.backgroundColor === '#05070A' && style?.position === 'absolute')
      && getTransformValue(styles, 'scale') !== undefined;
  });
  const frameStyles = flattenStyle(frameNode?.props.style);
  const contentStyles = flattenStyle(contentNode?.props.style);
  const top = getStyleValue(frameStyles, 'top') as number;
  const height = getStyleValue(frameStyles, 'height') as number;
  return {
    borderRadius: getStyleValue(frameStyles, 'borderRadius') as number,
    bottom: top + height,
    contentScale: getTransformValue(contentStyles, 'scale') as number,
    contentTranslateY: getTransformValue(contentStyles, 'translateY') as number,
    height,
    top,
    width: getStyleValue(frameStyles, 'width') as number,
  };
}

function getSearchSheetTranslateY(renderer: TestRenderer.ReactTestRenderer) {
  const searchSheet = renderer.root
    .findAll((node) => String(node.type) === 'Reanimated.View')
    .find((node) => flattenStyle(node.props.style).some((style) => style?.backgroundColor === '#1F2229'));
  return getTransformValue(flattenStyle(searchSheet?.props.style), 'translateY') as number;
}

const baseGroupBuy: GroupBuy = {
  id: 'group-buy-1',
  productName: '퍼스트 바이크',
  brandName: '퍼스트',
  startDate: '2026-07-01',
  endDate: '2099-12-31',
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
  (globalThis as any).__mockKeyboardHeight = 0;
  videoMock.players = [];
  videoMock.deferReplaceAsync = false;
  videoMock.replaceAsyncResolvers = [];
  queryMock.groupBuys = undefined;
  flashListMock.scrollToOffset.mockClear();
  pagerViewMock.setPage.mockClear();
  pagerViewMock.setPageWithoutAnimation.mockClear();
  (Alert.alert as any).mockClear();
  (Linking.openURL as any).mockClear();
  (Animated.timing as any).mockClear();
  (Animated.spring as any).mockClear();
});

describe('DetailScreen', () => {
  it('renders every media slide in a paging gallery', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const mediaScroll = renderer!.root.findAll((node) => String(node.type) === 'FlashList').find((node) => node.props.horizontal);
    const images = renderer!.root.findAll((node) => String(node.type) === 'Image');
    const text = flattenText(renderer!.toJSON());

    expect(mediaScroll?.props.pagingEnabled).toBe(true);
    expect(images).toHaveLength(3);
    expect(text).toContain('릴스');
    expect(text).toContain('구매');
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
      navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const horizontalList = renderer!.root
      .findAll((node) => String(node.type) === 'FlashList')
      .find((node) => node.props.horizontal);
    expect(renderer!.root.findAll((node) => String(node.type) === 'VideoView')).toHaveLength(1);
    expect(videoMock.players[0]?.pause).toHaveBeenCalled();
    expect(videoMock.players[0]?.play).not.toHaveBeenCalled();

    act(() => {
      horizontalList?.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 390 } } });
    });

    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    expect(videoViews).toHaveLength(1);
    expect(videoViews[0]?.props.contentFit).toBe('contain');
    expect(videoMock.players.some((player) => player.source.uri === 'https://cdn.example.com/slide-2-video.mp4')).toBe(true);
    expect(videoMock.players[0]?.source).toEqual({
      uri: 'https://cdn.example.com/slide-2-video.mp4',
      contentType: 'auto',
      useCaching: true,
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
          navigation={{ addListener: vi.fn(() => () => {}) } as any}
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const verticalPager = findVerticalPager(renderer!);
    const text = flattenText(renderer!.toJSON());

    expect(verticalPager).toBeDefined();
    expect(text).toContain('퍼스트 바이크');
    expect(text).toContain('다음 공구');
  });

  it('preserves fetched feed order and starts on the selected reel', () => {
    const previousGroupBuy: GroupBuy = {
      ...baseGroupBuy,
      id: 'group-buy-0',
      productName: '이전 공구',
      thumbnailUrl: 'https://example.com/previous.jpg',
      mediaUrls: ['https://example.com/previous.jpg'],
      rawPost: {
        postUrl: 'https://instagram.com/p/previous',
        influencer: {
          instagramUsername: 'previous_seller',
        },
      },
    };
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
    queryMock.groupBuys = [previousGroupBuy, baseGroupBuy, nextGroupBuy];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const verticalPager = findVerticalPager(renderer!);
    const text = flattenText(renderer!.toJSON());

    expect(verticalPager.props.initialPage).toBe(1);
    expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledWith(1);
    expect(text).toContain('이전 공구');
    expect(text).toContain('퍼스트 바이크');
    expect(text).toContain('다음 공구');
  });

  it('uses a native vertical pager so the reel settles only on full pages', () => {
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const verticalPager = findVerticalPager(renderer!);

    expect(verticalPager.props.orientation).toBe('vertical');
    expect(verticalPager.props.scrollEnabled).toBe(true);
    expect(verticalPager.props.overdrag).toBe(true);

    act(() => {
      verticalPager.props.onPageSelected({ nativeEvent: { position: 1 } });
    });

    expect(flattenText(renderer!.toJSON())).toContain('다음 공구');
  });

  it('clears an open summary sheet when leaving and returning to a reel page', () => {
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    )[0];

    act(() => {
      summaryButton?.props.onPress();
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);

    act(() => {
      findVerticalPager(renderer!).props.onPageSelected({ nativeEvent: { position: 1 } });
    });

    act(() => {
      findVerticalPager(renderer!).props.onPageSelected({ nativeEvent: { position: 0 } });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('does not move to the next reel from a summary bottom-edge pull-up while the sheet is open', () => {
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
    queryMock.groupBuys = [
      { ...baseGroupBuy, summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n') },
      nextGroupBuy,
    ];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: queryMock.groupBuys[0] } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    )[0];

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');
    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
      scrollView.props.onContentSizeChange(0, 360);
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 260 } } });
    });

    const verticalPager = findVerticalPager(renderer!);

    expect(verticalPager.props.scrollEnabled).toBe(false);

    act(() => {
      findSummaryScrollGesture(renderer!).onEnd({ translationY: -100, velocityY: -800 });
    });

    expect(pagerViewMock.setPage).not.toHaveBeenCalled();
    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('keeps the summary sheet open when bottom-edge pull-up has no next reel', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };
    queryMock.groupBuys = [groupBuy];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    )[0];

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');
    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
      scrollView.props.onContentSizeChange(0, 360);
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 260 } } });
      findSummaryScrollGesture(renderer!).onEnd({ translationY: -100, velocityY: -800 });
    });

    expect(pagerViewMock.setPage).not.toHaveBeenCalled();
    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);

    const summaryButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    )[0];

    act(() => {
      summaryButton.props.onPress();
    });

    const verticalPagerWhileOpen = findVerticalPager(renderer!);
    const raisedMediaStage = renderer!.root
      .findAll((node) => String(node.type) === 'Reanimated.View')
      .find((node) => {
        const style = node.props.style;
        const styles = Array.isArray(style) ? style : [style];
        return styles.some((item) => {
          const styleObj = item && typeof item === 'object' ? item : {};
          return styleObj.borderRadius !== undefined && styleObj.height !== undefined;
        });
      });

    expect(verticalPagerWhileOpen.props.scrollEnabled).toBe(false);
    expect(raisedMediaStage).toBeDefined();
    const mediaFrame = getMediaStageFrame(renderer!);
    const expectedSummarySheetHeight = Math.max(280, Math.min(844 - 24 - spacing.xl, 844 * 0.58));
    const mediaOpenTop = 24 + spacing.sm;
    const expectedMediaBottom = 844 - expectedSummarySheetHeight;
    const expectedContentScale = Math.min(1, Math.max((390 - 96) / 390, (expectedMediaBottom - mediaOpenTop) / 844));
    const summarySheet = renderer!.root
      .findAll((node) => String(node.type) === 'Reanimated.View')
      .find((node) => flattenStyle(node.props.style).some((style) => style?.backgroundColor === '#111417'));
    const topBar = renderer!.root
      .findAll((node) => String(node.type) === 'Reanimated.View')
      .find((node) => {
        const styles = flattenStyle(node.props.style);
        return styles.some((style) => style?.justifyContent === 'space-between')
          && getStyleValue(styles, 'opacity') !== undefined;
      });

    expect(getStyleValue(flattenStyle(summarySheet?.props.style), 'maxHeight')).toBeCloseTo(expectedSummarySheetHeight, 1);
    expect(mediaFrame.top).toBeCloseTo(mediaOpenTop, 1);
    expect(mediaFrame.bottom).toBeCloseTo(expectedMediaBottom, 1);
    expect(mediaFrame.height).toBeCloseTo(expectedMediaBottom - mediaOpenTop, 1);
    expect(mediaFrame.width).toBeCloseTo(390 - 96, 1);
    expect(mediaFrame.borderRadius).toBeCloseTo(22, 1);
    expect(mediaFrame.contentScale).toBeCloseTo(expectedContentScale, 2);
    expect(mediaFrame.contentTranslateY).toBeCloseTo((mediaFrame.height - 844) / 2, 1);
    expect(getStyleValue(flattenStyle(topBar?.props.style), 'opacity')).toBe(0);
    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
    expect(flattenText(renderer!.toJSON())).toContain('긴 설명도 시트에서 잘 보여야 합니다.');
    expect(flattenText(renderer!.toJSON())).toContain('구매 링크');
    expect(
      renderer!.root.find(
        (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 닫기',
      ),
    ).toBeDefined();

    const closeButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 닫기',
    );
    const purchaseButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '구매 링크',
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

  it('raises the search bottom sheet above the keyboard', () => {
    (globalThis as any).__mockKeyboardHeight = -300;

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const searchButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '상품 검색',
    );

    act(() => {
      searchButton.props.onPress();
    });

    expect(getSearchSheetTranslateY(renderer!)).toBe(-300);
  });

  it('shows an alert when the purchase link cannot be opened', async () => {
    (Linking.openURL as any).mockRejectedValueOnce(new Error('cannot open'));

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: baseGroupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const purchaseButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '구매 링크',
    )[0];

    act(() => {
      purchaseButton?.props.onPress();
    });
    await Promise.resolve();

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/buy');
    expect(Alert.alert).toHaveBeenCalledWith('오류', '구매 링크를 열 수 없습니다.');
  });

  it('does nothing when pressing a purchase link for an expired group buy', () => {
    const expiredGroupBuy: GroupBuy = {
      ...baseGroupBuy,
      endDate: '2020-01-01',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy: expiredGroupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const expiredButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '마감된 공구',
    )[0];

    act(() => {
      expiredButton?.props.onPress();
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('closes from top pull-downs and hands bottom pull-ups to the reel', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };
    queryMock.groupBuys = [
      groupBuy,
      {
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
      },
    ];

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    )[0];

    act(() => {
      summaryButton.props.onPress();
    });

    const scrollView = renderer!.root.find((node) => String(node.type) === 'ScrollView');

    act(() => {
      scrollView.props.onLayout({ nativeEvent: { layout: { height: 100 } } });
      scrollView.props.onContentSizeChange(0, 360);
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    });

    expect(findSummarySheetPanGesture(renderer!).enabled).toBe(true);
    expect(findSummaryScrollGesture(renderer!).enabled).toBe(false);

    const verticalPagerInMiddle = findVerticalPager(renderer!);
    expect(verticalPagerInMiddle.props.scrollEnabled).toBe(false);

    act(() => {
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    });

    expect(findSummaryScrollGesture(renderer!).enabled).toBe(true);
    expect(findSummaryScrollGesture(renderer!).activeOffsetY).toBe(4);

    const verticalPagerAtTop = findVerticalPager(renderer!);
    expect(verticalPagerAtTop.props.scrollEnabled).toBe(false);

    act(() => {
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 260 } } });
    });

    expect(findSummaryScrollGesture(renderer!).enabled).toBe(false);

    const verticalPagerAtBottom = findVerticalPager(renderer!);
    expect(verticalPagerAtBottom.props.scrollEnabled).toBe(false);
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
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
      scrollView.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { y: 0 } } });
      scrollView.props.onScrollEndDrag({
        nativeEvent: { contentOffset: { y: -56 }, velocity: { y: 0 } },
      });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('keeps the summary sheet open when the inner scroll only reaches the top during the same drag', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
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
      scrollView.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { y: 140 } } });
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('dismisses the summary sheet when pulling down from the top of the inner scroll', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
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
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      scrollView.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { y: 0 } } });
    });

    act(() => {
      const gesture = findSummaryScrollGesture(renderer!);
      gesture.onBegin();
      gesture.onUpdate({ translationY: 42, velocityY: 0 });
    });

    act(() => {
      findSummaryScrollGesture(renderer!).onEnd({ translationY: 90, velocityY: 0 });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('keeps the summary sheet open from an upward edge swipe at the top of the scroll', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: Array.from({ length: 16 }, (_, index) => `긴 설명 ${index + 1}`).join('\n'),
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
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
      scrollView.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    });

    expect(findSummaryScrollGesture(renderer!).activeOffsetY).toBe(4);

    act(() => {
      const gesture = findSummaryScrollGesture(renderer!);
      gesture.onBegin();
      gesture.onUpdate({ translationY: -120, velocityY: -800 });
      gesture.onEnd({ translationY: -120, velocityY: -800 });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('dismisses the summary sheet from a downward handle drag', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: '짧은 한 줄 요약입니다.',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    act(() => {
      const gesture = findSummarySheetPanGesture(renderer!);
      gesture.onBegin();
      gesture.onUpdate({ translationY: 180, velocityY: 100 });
      gesture.onEnd({ translationY: 180, velocityY: 100 });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);
  });

  it('keeps the summary sheet open when the handle is dragged upward', () => {
    const groupBuy: GroupBuy = {
      ...baseGroupBuy,
      summary: '짧은 한 줄 요약입니다.',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          route={{ key: 'Detail', name: 'Detail', params: { groupBuy } } as any}
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const summaryButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '요약 자세히 보기',
    );

    act(() => {
      summaryButton.props.onPress();
    });

    act(() => {
      const gesture = findSummarySheetPanGesture(renderer!);
      gesture.onBegin();
      gesture.onUpdate({ translationY: -180, velocityY: -200 });
      gesture.onEnd({ translationY: -180, velocityY: -200 });
    });

    expect(renderer!.root.findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('preloads adjacent product page videos without playing them', () => {
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
          navigation={{ goBack: vi.fn(), addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const verticalPager = findVerticalPager(renderer!);
    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    const nextVideoPlayers = videoMock.players.filter(
      (player) => player.source.uri === 'https://example.com/next-video.mp4',
    );

    expect(verticalPager).toBeDefined();
    expect(videoViews).toHaveLength(1);
    expect(nextVideoPlayers.length).toBeGreaterThanOrEqual(1);
    expect(nextVideoPlayers[0]?.source).toEqual({
      uri: 'https://example.com/next-video.mp4',
      contentType: 'auto',
      useCaching: true,
    });
    expect(nextVideoPlayers.some((player) => player.pause.mock.calls.length > 0)).toBe(true);
    expect(nextVideoPlayers.every((player) => player.play.mock.calls.length === 0)).toBe(true);
    expect(nextVideoPlayers.every((player) => player.currentTime === 0)).toBe(true);
  });

  it('preloads the second-next video without mounting another visible video or changing quality', async () => {
    const farVideoGroupBuy: GroupBuy = {
      ...baseGroupBuy,
      id: 'group-buy-video-far',
      productName: '두 칸 뒤 영상 공구',
      thumbnailUrl: 'https://example.com/far-thumb.jpg',
      videoUrl: 'https://example.com/far-video.mp4',
      mediaUrls: ['https://example.com/far-video.mp4'],
      mediaType: 'VIDEO',
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ReelVideoPreloader
          items={[baseGroupBuy, { ...baseGroupBuy, id: 'group-buy-middle' }, farVideoGroupBuy]}
          activeIndex={0}
          enabled
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const preloadedPlayer = videoMock.players.find(
      (player) => player.source?.uri === farVideoGroupBuy.videoUrl,
    );

    expect(renderer!.root.findAll((node) => String(node.type) === 'VideoView')).toHaveLength(0);
    expect(videoMock.players).toHaveLength(1);
    expect(preloadedPlayer?.source).toEqual({
      uri: farVideoGroupBuy.videoUrl,
      contentType: 'auto',
      useCaching: true,
    });
    expect(preloadedPlayer?.play).not.toHaveBeenCalled();
  });

  it('does not pause a released preloader player when a pending preload resolves after unmount', async () => {
    videoMock.deferReplaceAsync = true;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ReelVideoPreloader
          items={[baseGroupBuy, { ...baseGroupBuy, id: 'group-buy-middle' }, baseGroupBuy]}
          activeIndex={0}
          enabled
        />,
      );
    });

    const preloadedPlayer = videoMock.players[0];
    expect(videoMock.replaceAsyncResolvers).toHaveLength(1);

    act(() => {
      renderer!.unmount();
    });
    expect(preloadedPlayer.pause).not.toHaveBeenCalled();

    await act(async () => {
      videoMock.replaceAsyncResolvers[0]?.();
      await Promise.resolve();
    });

    expect(preloadedPlayer.pause).not.toHaveBeenCalled();
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
          navigation={{ addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    const images = renderer!.root.findAll((node) => String(node.type) === 'Image');
    expect(videoViews).toHaveLength(1);
    expect(images).toHaveLength(2);
    expect(images.some((image) => image.props.source?.uri === groupBuy.thumbnailUrl)).toBe(true);
    expect(videoViews[0]?.props.contentFit).toBe('contain');
    expect(videoViews[0]?.props.pointerEvents).toBe('none');
    expect(videoMock.players[0]?.source).toEqual({
      uri: 'https://cdn.example.com/media-test?id=abc123',
      contentType: 'auto',
      useCaching: true,
    });
    expect(videoMock.players[0]?.muted).toBe(false);
    expect(videoMock.players[0]?.volume).toBe(1);
    expect(videoMock.players[0]?.audioMixingMode).toBe('doNotMix');
    expect(videoMock.players[0]?.play).toHaveBeenCalled();
  });

  it('shows playback and mute controls when the video is tapped', () => {
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
          navigation={{ addListener: vi.fn(() => () => {}) } as any}
        />,
      );
    });

    const getTotalPlayCalls = () => videoMock.players.reduce((sum, item) => sum + item.play.mock.calls.length, 0);
    const getTotalPauseCalls = () => videoMock.players.reduce((sum, item) => sum + item.pause.mock.calls.length, 0);
    const videoViews = renderer!.root.findAll((node) => String(node.type) === 'VideoView');
    const controlsButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '동영상 컨트롤 표시',
    );

    expect(videoViews).toHaveLength(1);
    expect(controlsButton.props.pressRetentionOffset).toBe(24);

    act(() => {
      controlsButton.props.onPress();
    });

    const pauseButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '동영상 일시정지',
    );
    const muteButton = renderer!.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '음소거',
    );
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

    act(() => {
      muteButton.props.onPress();
    });

    expect(videoMock.players.some((item) => item.muted === true)).toBe(true);
    expect(
      renderer!.root.find(
        (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === '음소거 해제',
      ),
    ).toBeDefined();
  });
});
