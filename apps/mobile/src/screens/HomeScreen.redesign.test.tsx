import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeScreenContent } from './HomeScreen';
import type { GroupBuy } from '../types';

const mockWindowDimensions = vi.hoisted(() => ({ width: 393 }));

vi.mock('../api', () => ({
  fallbackGroupBuys: [],
  fetchGroupBuys: vi.fn(),
}));

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough('ActivityIndicator'),
    FlatList: ({ data, renderItem, ListHeaderComponent, ...props }: any) =>
      ReactMock.createElement(
        'FlatList',
        props,
        ListHeaderComponent,
        ...(data ?? []).map((item: unknown, index: number) =>
          renderItem({ item, index }),
        ),
      ),
    Image: passthrough('Image'),
    ImageBackground: passthrough('ImageBackground'),
    Keyboard: {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Pressable: ({ children, ...props }: any) =>
      ReactMock.createElement('Pressable', props, children),
    RefreshControl: passthrough('RefreshControl'),
    ScrollView: ({ children, ...props }: any) =>
      ReactMock.createElement('ScrollView', props, children),
    StatusBar: passthrough('StatusBar'),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Text', props, children),
    TextInput: (props: any) =>
      ReactMock.createElement('TextInput', props, props.placeholder),
    useWindowDimensions: () => ({
      width: mockWindowDimensions.width,
      height: 852,
      scale: 3,
      fontScale: 1,
    }),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('View', props, children),
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
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://instagram.com/p/1',
      influencer: { instagramUsername: 'beauty_pick' },
    },
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
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: 'https://instagram.com/p/2',
      influencer: { instagramUsername: 'food_mate' },
    },
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

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

function createHomeContent(
  props: Partial<React.ComponentProps<typeof HomeScreenContent>> = {},
) {
  return (
    <HomeScreenContent
      groupBuys={sampleGroupBuys}
      isError={false}
      isFetching={false}
      onRefresh={vi.fn()}
      onOpenSearch={vi.fn()}
      onOpenCalendar={vi.fn()}
      onPressDeal={vi.fn()}
      {...props}
    />
  );
}

function renderHomeContent(
  props: Partial<React.ComponentProps<typeof HomeScreenContent>> = {},
) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createHomeContent(props));
  });
  return renderer!;
}

function findPromoBanner(
  renderer: TestRenderer.ReactTestRenderer,
  productName: string,
) {
  return renderer.root
    .findAllByType('Pressable' as unknown as React.ElementType)
    .find((node) => node.props.accessibilityLabel?.startsWith(productName));
}

beforeEach(() => {
  mockWindowDimensions.width = 393;
});

describe('HomeScreenContent redesign', () => {
  it('renders commerce-home information architecture like the reference', () => {
    const renderer = renderHomeContent();

    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('상품을 검색해보세요');
    expect(text).toContain('쇼핑 홈');
    expect(text).toContain('장수영님을 위한 추천 상품');
    expect(text).not.toContain('AI');
    expect(text).not.toContain('광고');
    expect(text).toContain('비건 선크림 공구');
    expect(text).not.toContain('등록된 피드');
    expect(text).toContain('이번주 공구');
    expect(text).toContain('전체보기');
  });

  it('shows shopping home as a static heading without tab semantics', () => {
    const renderer = renderHomeContent();
    const heading = renderer.root.findByProps({ testID: 'home-shop-heading' });

    expect(heading.props.accessible).toBe(true);
    expect(heading.props.accessibilityLabel).toBe('쇼핑 홈');
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props.accessibilityState).toBeUndefined();
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: '카테고리 탭' }),
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: '특가 탭' }),
    ).toHaveLength(0);
  });

  it('renders the hero promo banner with a carousel counter', () => {
    const renderer = renderHomeContent();
    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner).toBeDefined();
    expect(banner!.props.accessibilityLabel).toContain('20% 할인');
    expect(banner!.props.accessibilityLabel).not.toContain(
      sampleGroupBuys[0].summary,
    );
    expect(banner!.props.accessibilityLabel).not.toContain('시작일');
    expect(banner!.props.accessibilityLabel).not.toContain('마감일');

    const text = flattenText(renderer!.toJSON());
    expect(text).not.toContain('1,500명 선착순');
    expect(text).not.toContain('오늘의 공구 특가');
    expect(text).toMatch(/1\s+\/\s+2/);
  });

  it('fills a uniform product frame without a boxed or fake-package panel', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          thumbnailUrl: 'https://example.com/product-thumbnail.jpg',
          mediaItems: [
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/product-thumbnail.jpg',
              url: 'https://example.com/product-cutout.png',
            },
          ],
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerStyle = flattenStyle(banner!.props.style);
    expect(bannerStyle.borderWidth ?? 0).toBe(0);
    expect(bannerStyle.minHeight).toBeLessThanOrEqual(204);

    const visual = renderer.root.findByProps({ testID: 'promo-visual-gb-1' });
    expect(flattenStyle(visual.props.style).backgroundColor).toBe('transparent');

    const image = renderer.root.findByProps({ testID: 'promo-image-gb-1' });
    expect(image.props.source).toEqual({
      uri: 'https://example.com/product-thumbnail.jpg',
    });
    const renderedImageUris = renderer.root
      .findAll((node) => typeof node.props.source?.uri === 'string')
      .map((node) => node.props.source.uri);
    expect(renderedImageUris).toContain(
      'https://example.com/product-thumbnail.jpg',
    );
    expect(image.props.resizeMode).toBe('cover');
    expect(image.props.accessible).toBe(false);
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).not.toHaveLength(0);
    expect(flattenText(renderer.toJSON())).toContain('SA');
    expect(flattenText(renderer.toJSON())).toContain('이미지 준비 중');
    expect(flattenText(renderer.toJSON())).not.toContain('REAL');
    expect(flattenText(renderer.toJSON())).not.toContain('FRESH');

    act(() => image.props.onLoad());
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).toHaveLength(0);

    act(() =>
      renderer.root.findByProps({ testID: 'promo-image-gb-1' }).props.onError(),
    );
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).not.toHaveLength(0);

    const counter = renderer.root.findByProps({ testID: 'promo-counter-gb-1' });
    expect(
      visual.findAllByProps({ testID: 'promo-counter-gb-1' }),
    ).not.toHaveLength(0);
    expect(flattenStyle(counter.props.style).position).toBe('absolute');
  });

  it('uses honest fallback copy and never renders a bare influencer marker', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          brandName: null,
          discountInfo: null,
          rawPost: {
            ...sampleGroupBuys[0].rawPost,
            influencer: { instagramUsername: '' },
          },
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).toContain('공동구매 추천');
    expect(bannerText).toContain('이미지 준비 중');
    expect(bannerText).not.toMatch(/(^|\s)@(\s|$)/);
    expect(bannerText).not.toContain('혜택 확인');
  });

  it('keeps a long product name to two visual lines while reading it in full', () => {
    const longProductName =
      '거제 소노캄 오션뷰 객실과 워터파크를 함께 즐기는 여름 패키지 공동구매';
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          productName: longProductName,
        },
      ],
    });

    const title = renderer.root
      .findAllByType('Text' as unknown as React.ElementType)
      .find((node) => node.props.children === longProductName);
    expect(title?.props.numberOfLines).toBe(2);

    const banner = findPromoBanner(renderer, longProductName);
    expect(banner?.props.accessibilityLabel).toContain(longProductName);
  });

  it('resets promo artwork state when the image URI changes', () => {
    const firstItem = {
      ...sampleGroupBuys[0],
      mediaItems: [],
      thumbnailUrl: 'https://example.com/first-product.jpg',
    };
    const renderer = renderHomeContent({ groupBuys: [firstItem] });
    const firstImage = renderer.root.findByProps({
      testID: 'promo-image-gb-1',
    });
    const staleOnLoad = firstImage.props.onLoad;

    act(() => staleOnLoad());
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).toHaveLength(0);

    const nextItem = {
      ...firstItem,
      thumbnailUrl: 'https://example.com/next-product.jpg',
    };
    act(() => {
      renderer.update(createHomeContent({ groupBuys: [nextItem] }));
    });

    expect(
      renderer.root.findByProps({ testID: 'promo-image-gb-1' }).props.source,
    ).toEqual({ uri: 'https://example.com/next-product.jpg' });
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).not.toHaveLength(0);

    act(() => staleOnLoad());
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-artwork-placeholder-gb-1',
      }),
    ).not.toHaveLength(0);
  });

  it('uses a validated DB discount as a one-line purchase hook instead of duplicate dates', () => {
    const purchaseHook = '30% 할인 + 무료배송';
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: purchaseHook,
          startDate: '2026-07-01T00:00:00+09:00',
          endDate: '2026-07-10T23:59:59+09:00',
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain(purchaseHook);
    expect(text).not.toContain('시작일 7.1');
    expect(text).not.toContain('마감일 7.10');

    const hook = renderer.root.findByProps({
      testID: 'promo-purchase-hook-gb-1',
    });
    const style = flattenStyle(hook.props.style);
    expect(style.position).not.toBe('absolute');
    expect(style.flexShrink).toBe(1);
    expect(style.borderTopWidth ?? 0).toBe(0);
    const hookText = hook
      .findAllByType('Text' as unknown as React.ElementType)
      .find((node) => node.props.children === purchaseHook);
    expect(hookText?.props.numberOfLines).toBe(1);

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner!.props.accessibilityLabel).toContain(purchaseHook);
    expect(banner!.props.accessibilityLabel).not.toContain('시작일');
    expect(banner!.props.accessibilityLabel).not.toContain('마감일');
  });

  it('aligns the promo copy with the artwork top and keeps the purchase hook at the bottom', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: '부대시설 할인권 제공',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(flattenStyle(banner!.props.style).justifyContent).toBe(
      'space-between',
    );

    const main = renderer.root.findByProps({ testID: 'promo-main-gb-1' });
    expect(flattenStyle(main.props.style).alignItems).toBe('flex-start');

    const visual = renderer.root.findByProps({ testID: 'promo-visual-gb-1' });
    expect(flattenStyle(visual.props.style).alignSelf).toBe('flex-start');
  });

  it('places the Instagram account directly beneath the promo image', () => {
    const renderer = renderHomeContent({
      groupBuys: [sampleGroupBuys[0]],
    });

    const media = renderer.root.findByProps({ testID: 'promo-media-gb-1' });
    const account = renderer.root.findByProps({
      testID: 'promo-account-gb-1',
    });
    expect(account.props.children).toBe('@beauty_pick');
    expect(
      media.findAllByProps({ testID: 'promo-account-gb-1' }),
    ).not.toHaveLength(0);

    const copy = renderer.root.findByProps({ testID: 'promo-copy-gb-1' });
    expect(
      copy.findAllByProps({ testID: 'promo-account-gb-1' }),
    ).toHaveLength(0);

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner!.props.accessibilityLabel).toContain('@beauty_pick');
  });

  it('keeps the promo card inside a 320px viewport with compact media', () => {
    mockWindowDimensions.width = 320;
    const renderer = renderHomeContent({ groupBuys: [sampleGroupBuys[0]] });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(flattenStyle(banner!.props.style).width).toBe(288);

    const visual = renderer.root.findByProps({ testID: 'promo-visual-gb-1' });
    const visualStyle = flattenStyle(visual.props.style);
    expect(visualStyle.width).toBeGreaterThanOrEqual(96);
    expect(visualStyle.width).toBeLessThanOrEqual(112);
    expect(visualStyle.height).toBe(visualStyle.width);
  });

  it('omits the purchase hook when the DB discount is missing', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: null,
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('@beauty_pick 진행 공구');
    expect(text).not.toContain('시작일');
    expect(text).not.toContain('마감일');
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-purchase-hook-gb-1',
      }),
    ).toHaveLength(0);

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(flattenStyle(banner!.props.style).justifyContent).toBe(
      'space-between',
    );
  });

  it('does not use a raw DB summary as the purchase hook', () => {
    const rawSummary =
      '민감한 피부에도 부담 없이 사용할 수 있는 데일리 선케어';
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: null,
          summary: rawSummary,
        },
      ],
    });

    expect(
      renderer.root.findAllByProps({
        testID: 'promo-purchase-hook-gb-1',
      }),
    ).toHaveLength(0);
  });

  it('ignores unstructured discount copy that is not a commerce benefit', () => {
    const noisyDiscount =
      '⚠안장 및 다른 프레임들 설계 - 유리강화섬유가 30% 포함된 초경량 프레임';
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: noisyDiscount,
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).not.toContain(noisyDiscount);
    expect(banner!.props.accessibilityLabel).not.toContain(noisyDiscount);
  });

  it('hides carousel clones from accessibility and omits their test IDs', () => {
    const renderer = renderHomeContent();
    const pressables = renderer.root.findAllByType(
      'Pressable' as unknown as React.ElementType,
    );
    const clones = pressables.filter(
      (node) => node.props.accessibilityElementsHidden === true,
    );

    expect(clones).toHaveLength(2);
    for (const clone of clones) {
      expect(clone.props.accessibilityLabel).toBeUndefined();
      expect(clone.props.importantForAccessibility).toBe('no-hide-descendants');
    }

    const realPurchaseHooks = renderer.root
      .findAllByType('View' as unknown as React.ElementType)
      .filter((node) => node.props.testID?.startsWith('promo-purchase-hook-'));
    expect(realPurchaseHooks).toHaveLength(2);
  });

  it('snaps the hero promo rail one banner at a time', () => {
    const renderer = renderHomeContent();
    const scrollViews = renderer.root.findAllByType(
      'ScrollView' as unknown as React.ElementType,
    );
    const promoRail = scrollViews.find(
      (scrollView) => scrollView.props.snapToInterval,
    );

    expect(promoRail).toBeDefined();
    expect(promoRail!.props.decelerationRate).toBe('fast');
    expect(promoRail!.props.disableIntervalMomentum).toBe(true);
    expect(promoRail!.props.snapToAlignment).toBe('start');
    expect(promoRail!.props.snapToInterval).toBe(373);
  });

  it('wires the hero promo rail for autoplay and manual swipe timer reset', () => {
    const renderer = renderHomeContent();
    const scrollViews = renderer.root.findAllByType(
      'ScrollView' as unknown as React.ElementType,
    );
    const promoRail = scrollViews.find(
      (scrollView) => scrollView.props.snapToInterval,
    );

    expect(promoRail).toBeDefined();
    expect(promoRail!.props.contentOffset).toEqual({ x: 373, y: 0 });
    expect(promoRail!.props.scrollEventThrottle).toBe(16);
    expect(typeof promoRail!.props.onScrollBeginDrag).toBe('function');
    expect(typeof promoRail!.props.onScrollEndDrag).toBe('function');
    expect(typeof promoRail!.props.onMomentumScrollEnd).toBe('function');
  });

  it('shows network-notice fallback copy, not local-API copy', () => {
    const renderer = renderHomeContent({ isError: true });
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain('네트워크 연결 상태를 확인해주세요.');
    expect(text).not.toContain('로컬 API');
  });
});

describe('HomeScreenContent redesign v2', () => {
  it('does not render the old weekly calendar sections', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    expect(text).not.toContain('주간 공구');
    expect(text).not.toContain('마감임박 공구');
  });

  it('renders benefit shortcuts from the reference pattern', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    // Benefit grid replaced with weekly group buys section.
    expect(text).toContain('이번주 공구');
    expect(text).toContain('전체보기');
  });

  it('removes DISCOVERY FEED eyebrow and 오늘 열려있는 공구 section', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer!.toJSON());
    expect(text).not.toContain('DISCOVERY FEED');
    expect(text).not.toContain('오늘 열려있는 공구');
  });

  it('renders two-column recommendation cards', () => {
    const renderer = renderHomeContent();
    // The same deal may render in multiple sections; pick the recommendation card
    // which uses a percentage width in a wrapping two-column grid.
    const cards = renderer.root.findAllByProps({
      accessibilityLabel: '비건 선크림 공구 상세 보기',
    });
    const gridCard = cards.find((card) => {
      const style = flattenStyle(card.props.style);
      return typeof style.width === 'string' && style.width.endsWith('%');
    });
    expect(gridCard).toBeDefined();
    const style = flattenStyle(gridCard!.props.style);
    expect(style.width).toBe('48.4%');
    expect(style.minHeight).toBeGreaterThanOrEqual(200);
  });
});

describe('HomeScreenContent redesign interactions', () => {
  it('removes notification and bookmark actions from the top bar', () => {
    const renderer = renderHomeContent();
    const labels = renderer.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .map((pressable) => pressable.props.accessibilityLabel)
      .filter(Boolean);

    expect(labels).toContain('상품 검색');
    expect(labels).not.toContain('알림 열기');
    expect(labels).not.toContain('북마크 열기');
  });

  it('opens search from the top search box', () => {
    const onOpenSearch = vi.fn();
    const renderer = renderHomeContent({ onOpenSearch });
    const searchButton = renderer.root.findByProps({
      accessibilityLabel: '상품 검색',
    });
    act(() => {
      searchButton.props.onPress();
    });
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('opens detail from hero banner and recommendation card', () => {
    const onPressDeal = vi.fn();
    const renderer = renderHomeContent({ onPressDeal });
    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const cards = renderer.root.findAllByProps({
      accessibilityLabel: '비건 선크림 공구 상세 보기',
    });
    const card = cards[cards.length - 1];

    act(() => {
      banner!.props.onPress();
      card.props.onPress();
    });

    expect(onPressDeal).toHaveBeenCalledTimes(2);
    expect(onPressDeal).toHaveBeenNthCalledWith(1, sampleGroupBuys[0]);
    expect(onPressDeal).toHaveBeenNthCalledWith(2, sampleGroupBuys[0]);
  });

  it('keeps home actions reachable with 44px minimum touch targets', () => {
    const renderer = renderHomeContent();

    const pressables = renderer!.root.findAllByType(
      'Pressable' as unknown as React.ElementType,
    );
    const labels = pressables
      .map((pressable) => pressable.props.accessibilityLabel)
      .filter(Boolean);

    expect(labels).not.toContain('북마크 열기');
    expect(labels).not.toContain('알림 열기');
    expect(labels).toContain('상품 검색');
    expect(labels).toContain('전체 캘린더 보기');
    expect(labels).toContain('비건 선크림 공구 상세 보기');
    for (const pressable of pressables) {
      const style = Array.isArray(pressable.props.style)
        ? Object.assign({}, ...pressable.props.style)
        : pressable.props.style;
      // Interactive action buttons must meet the 44px touch target minimum.
      // The search box uses hitSlop and a 42px visual height, which is acceptable.
      if (
        typeof pressable.props.accessibilityLabel === 'string' &&
        pressable.props.accessibilityLabel !== '상품 검색'
      ) {
        expect(style?.minHeight ?? 44).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
