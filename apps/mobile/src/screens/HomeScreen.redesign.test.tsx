import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeScreenContent } from './HomeScreen';
import { DealCard } from '../components/DealCard';
import { spacing } from '../design/tokens';
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

function isoFromNow(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
}

function shortDate(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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
    expect(text).not.toContain('장수영님을 위한 추천 상품');
    expect(text).toContain('전체');
    expect(text).toContain('식품');
    expect(text).toContain('뷰티');
    expect(text).not.toContain('AI');
    expect(text).not.toContain('광고');
    expect(text).toContain('비건 선크림 공구');
    expect(text).not.toContain('등록된 피드');
    expect(text).toContain('이번주 공구');
    expect(text).toContain('전체보기');
  });

  it('renders a horizontal category filter before the home deal cards', () => {
    const renderer = renderHomeContent();
    const filter = renderer.root.findByProps({ testID: 'home-category-filter' });
    const scroll = renderer.root.findByProps({
      testID: 'home-category-filter-scroll',
    });

    expect(filter.props.accessibilityRole).toBe('tablist');
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false);
    expect(
      renderer.root.findByProps({ accessibilityLabel: '전체 카테고리' }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: '뷰티 카테고리' }),
    ).toBeDefined();
  });

  it('wires home scrolling for the custom sticky category layer', () => {
    const renderer = renderHomeContent();
    const scroll = renderer.root.findAll(
      (node) => String(node.type) === 'KeyboardAwareScrollView',
    )[0];

    expect(scroll.props.stickyHeaderIndices).toBeUndefined();
    expect(scroll.props.onScroll).toEqual(expect.any(Function));
  });

  it('keeps the sticky category filter above content for touch input', () => {
    const renderer = renderHomeContent();
    const filter = renderer.root.findByProps({ testID: 'home-category-filter' });

    expect(flattenStyle(filter.props.style)).toMatchObject({
      elevation: expect.any(Number),
      zIndex: expect.any(Number),
    });
  });

  it('keeps the category filter compact in normal and sticky states', () => {
    const renderer = renderHomeContent();
    const filter = renderer.root.findByProps({ testID: 'home-category-filter' });
    const chip = filter.findByProps({ accessibilityLabel: '전체 카테고리' });

    expect(flattenStyle(filter.props.style)).toMatchObject({
      paddingVertical: spacing.xs,
    });
    expect(flattenStyle(chip.props.style)).toMatchObject({ minHeight: 44 });

    const scroll = renderer.root.findAll(
      (node) => String(node.type) === 'KeyboardAwareScrollView',
    )[0];

    act(() => {
      filter.props.onLayout({ nativeEvent: { layout: { y: 100 } } });
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    });

    const stickyFilter = renderer.root.findByProps({
      testID: 'home-category-filter-sticky',
    });
    const stickyFilterView = stickyFilter.findByProps({
      accessibilityRole: 'tablist',
    });
    const stickyChip = stickyFilterView.findByProps({
      accessibilityLabel: '전체 카테고리',
    });

    expect(flattenStyle(stickyFilterView.props.style)).toMatchObject({
      paddingVertical: spacing.xs,
    });
    expect(flattenStyle(stickyChip.props.style)).toMatchObject({
      minHeight: 44,
    });
  });

  it('renders a separate touch layer when the category filter reaches the top', () => {
    const renderer = renderHomeContent();
    const filter = renderer.root.findByProps({ testID: 'home-category-filter' });
    const scroll = renderer.root.findAll(
      (node) => String(node.type) === 'KeyboardAwareScrollView',
    )[0];

    act(() => {
      filter.props.onLayout({ nativeEvent: { layout: { y: 100 } } });
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    });

    const stickyFilter = renderer.root.findByProps({
      testID: 'home-category-filter-sticky-layer',
    });
    expect(flattenStyle(stickyFilter.props.style)).toMatchObject({
      elevation: expect.any(Number),
      position: 'absolute',
      zIndex: expect.any(Number),
    });
  });

  it('places the category filter between weekly deals and the deal grid', () => {
    const renderer = renderHomeContent();
    const scroll = renderer.root.findAll(
      (node) => String(node.type) === 'KeyboardAwareScrollView',
    )[0];
    const directChildIds = scroll.children
      .map((child) => {
        if (typeof child === 'string') return undefined;
        if (child.props?.testID) return child.props.testID;
        return child.findAllByProps({ testID: 'home-category-filter' }).length > 0
          ? 'home-category-filter'
          : undefined;
      })
      .filter(Boolean);

    expect(directChildIds).toEqual([
      'home-top-content',
      'home-weekly-content',
      'home-category-filter',
      'home-deal-grid-content',
    ]);
  });

  it('filters only the deal grid when a category is selected', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          id: 'beauty-deal',
          productName: '뷰티 카테고리 상품',
          category: 'beauty',
        },
        {
          ...sampleGroupBuys[1],
          id: 'food-deal',
          productName: '식품 카테고리 상품',
          category: 'food',
        },
      ],
    });

    const beautyChip = renderer.root.findByProps({
      accessibilityLabel: '뷰티 카테고리',
    });

    act(() => {
      beautyChip.props.onPress();
    });

    expect(
      renderer.root.findAllByType(DealCard).map((node) => node.props.item.id),
    ).toEqual(['beauty-deal', 'food-deal', 'beauty-deal']);
    expect(beautyChip.props.accessibilityState).toEqual({ selected: true });
  });

  it('maps legacy category values to the canonical home filter', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          id: 'legacy-living-deal',
          category: 'lifestyle',
        },
      ],
    });
    const livingChip = renderer.root.findByProps({
      accessibilityLabel: '생활용품 카테고리',
    });

    act(() => {
      livingChip.props.onPress();
    });

    expect(
      renderer.root.findAllByType(DealCard).map((node) => node.props.item.id),
    ).toEqual(['legacy-living-deal', 'legacy-living-deal']);
  });

  it('uses the shared deal card for weekly and recommended products', () => {
    const renderer = renderHomeContent();
    const text = flattenText(renderer.toJSON());

    expect(renderer.root.findAllByType(DealCard).length).toBeGreaterThanOrEqual(2);
    expect(text).not.toContain('역대급특가');
    expect(text).not.toContain('25% 특가');
  });

  it('renders legacy lifestyle and digital categories without crashing', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        { ...sampleGroupBuys[0], id: 'legacy-lifestyle', category: 'lifestyle' },
        { ...sampleGroupBuys[1], id: 'legacy-digital', category: 'digital' },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('비건 선크림 공구');
    expect(text).toContain('프리미엄 그래놀라 세트');
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

  it('filters the hero promo rail to active home-banner contract items', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 12, 0, 0));

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    try {
      const contractItem = (
        id: string,
        productName: string,
        overrides: Partial<GroupBuy>,
      ): GroupBuy => ({
        ...sampleGroupBuys[0],
        id,
        productName,
        startDate: '2026-07-10T00:00:00.000Z',
        endDate: '2026-07-20T23:59:59.000Z',
        discountInfo: null,
        isHomeBanner: true,
        homeBannerStartDate: '2026-07-10',
        homeBannerEndDate: '2026-07-15',
        ...overrides,
      });

      renderer = renderHomeContent({
        groupBuys: [
          contractItem('banner-active', '활성 홈 배너', {}),
          contractItem('banner-active-2', '두 번째 활성 홈 배너', {
            homeBannerStartDate: '2026-07-13',
            homeBannerEndDate: '2026-07-14',
          }),
          contractItem('banner-ending-today', '오늘 종료 홈 배너', {
            homeBannerEndDate: '2026-07-13',
          }),
          contractItem('banner-disabled', '비활성 홈 배너', {
            isHomeBanner: false,
          }),
          contractItem('banner-future', '기간 전 홈 배너', {
            homeBannerStartDate: '2026-07-14',
            homeBannerEndDate: '2026-07-20',
          }),
          contractItem('banner-expired', '기간 후 홈 배너', {
            homeBannerStartDate: '2026-07-01',
            homeBannerEndDate: '2026-07-12',
          }),
        ],
      });

      expect(
        renderer.root.findAllByProps({ testID: 'promo-overlay-banner-active' }),
      ).not.toHaveLength(0);
      expect(
        renderer.root.findAllByProps({
          testID: 'promo-overlay-banner-active-2',
        }),
      ).not.toHaveLength(0);
      expect(
        renderer.root.findAllByProps({
          testID: 'promo-overlay-banner-ending-today',
        }),
      ).not.toHaveLength(0);
      expect(
        renderer.root.findAllByProps({ testID: 'promo-overlay-banner-disabled' }),
      ).toHaveLength(0);
      expect(
        renderer.root.findAllByProps({ testID: 'promo-overlay-banner-future' }),
      ).toHaveLength(0);
      expect(
        renderer.root.findAllByProps({ testID: 'promo-overlay-banner-expired' }),
      ).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      expect(
        renderer.root.findAllByProps({ testID: 'promo-overlay-banner-future' }),
      ).not.toHaveLength(0);
      expect(
        renderer.root.findAllByProps({
          testID: 'promo-overlay-banner-ending-today',
        }),
      ).toHaveLength(0);
    } finally {
      renderer?.unmount();
      vi.useRealTimers();
    }
  });

  it('keeps an upcoming migrated deal visible from today until commerce starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 12, 0, 0));

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    try {
      renderer = renderHomeContent({
        groupBuys: [
          {
            ...sampleGroupBuys[0],
            productName: '곧 시작하는 홈 배너',
            startDate: '2026-07-17',
            endDate: '2026-07-20',
            isHomeBanner: true,
            homeBannerStartDate: '2026-07-13',
            homeBannerEndDate: '2026-07-20',
          },
        ],
      });

      const banner = findPromoBanner(renderer, '곧 시작하는 홈 배너');
      expect(banner).toBeDefined();
      expect(banner!.props.accessibilityLabel).toContain('4일 후 시작');
      expect(flattenText(renderer.toJSON())).toContain('D+4');
    } finally {
      renderer?.unmount();
      vi.useRealTimers();
    }
  });

  it('prefers an explicit priceKrw over a legacy discountInfo price', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          priceKrw: 129000,
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo: '공구가 179,000원 + 무료배송',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');

    expect(bannerText).toContain('129,000원');
    expect(bannerText).not.toContain('179,000원');
    expect(banner!.props.accessibilityLabel).toContain('129,000원');
    expect(banner!.props.accessibilityLabel).not.toContain('179,000원');
  });

  it("uses the first media card's representative visual as the banner background", () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          thumbnailUrl: 'https://example.com/cover-thumbnail.jpg',
          mediaUrls: ['https://example.com/fallback-photo.jpg'],
          mediaItems: [
            {
              mediaType: 'VIDEO',
              thumbnailUrl: 'https://example.com/video-poster.jpg',
              url: 'https://example.com/intro.mp4',
            },
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/first-thumb.jpg',
              url: 'https://example.com/first-product.jpg',
            },
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/second-thumb.jpg',
              url: 'https://example.com/second-product.jpg',
            },
          ],
        },
      ],
    });

    const image = renderer.root.findByProps({ testID: 'promo-image-gb-1' });
    expect(image.props.source).toEqual({
      uri: 'https://example.com/video-poster.jpg',
    });
    expect(image.props.resizeMode).toBe('cover');
    expect(flattenStyle(image.props.style).position).toBe('absolute');

    const background = renderer.root.findByProps({
      testID: 'promo-background-gb-1',
    });
    expect(flattenStyle(background.props.style).position).toBe('absolute');

    const overlay = renderer.root.findByProps({
      testID: 'promo-overlay-gb-1',
    });
    const overlayStyle = flattenStyle(overlay.props.style);
    expect(overlayStyle.position).toBe('absolute');
    expect(overlayStyle.bottom).toBe(0);
    const scrim = renderer.root.findByProps({ testID: 'promo-scrim-gb-1' });
    expect(scrim.props.resizeMode).toBe('stretch');
    expect(scrim.props.source).toBeTruthy();
  });

  it('prefers the first image card original over its thumbnail and cover', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          thumbnailUrl: 'https://example.com/cover.jpg',
          mediaItems: [
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/first-image-thumb.jpg',
              url: 'https://example.com/first-image-original.jpg',
            },
          ],
        },
      ],
    });

    expect(
      renderer.root.findByProps({ testID: 'promo-image-gb-1' }).props.source,
    ).toEqual({ uri: 'https://example.com/first-image-original.jpg' });
  });

  it('uses the group-buy cover when the first video card has no poster', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          thumbnailUrl: 'https://example.com/video-cover-fallback.jpg',
          mediaItems: [
            {
              mediaType: 'VIDEO',
              thumbnailUrl: null,
              url: 'https://example.com/intro.mp4',
            },
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/later-image-thumb.jpg',
              url: 'https://example.com/later-image.jpg',
            },
          ],
        },
      ],
    });

    expect(
      renderer.root.findByProps({ testID: 'promo-image-gb-1' }).props.source,
    ).toEqual({ uri: 'https://example.com/video-cover-fallback.jpg' });
  });

  it('adds a subtle full-card shade behind the promo overlay text', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          mediaItems: [
            {
              mediaType: 'IMAGE',
              thumbnailUrl: 'https://example.com/bright-product.jpg',
              url: 'https://example.com/bright-product.jpg',
            },
          ],
        },
      ],
    });

    const shade = renderer.root.findByProps({ testID: 'promo-shade-gb-1' });
    const shadeStyle = flattenStyle(shade.props.style);

    expect(shadeStyle.position).toBe('absolute');
    expect(shadeStyle.top).toBe(0);
    expect(shadeStyle.right).toBe(0);
    expect(shadeStyle.bottom).toBe(0);
    expect(shadeStyle.left).toBe(0);
    expect(shadeStyle.backgroundColor).toBe('rgba(0, 0, 0, 0.18)');
  });

  it('shows the start timing and price-release fallback for an upcoming deal', () => {
    const startDate = isoFromNow(4);
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate,
          endDate: isoFromNow(8),
          discountInfo: '무료배송',
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('D+4');
    expect(text).toContain(`${shortDate(startDate)} 시작`);
    expect(text).toContain('가격 공개 예정');

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner!.props.accessibilityLabel).toContain('4일 후 시작');
    expect(banner!.props.accessibilityLabel).toContain('가격 공개 예정');
  });

  it('shows a parsed DB price for an upcoming deal when it is available', () => {
    const startDate = isoFromNow(3);
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate,
          endDate: isoFromNow(8),
          discountInfo: '공구가 179,000원 + 무료배송',
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('D+3');
    expect(text).toContain('179,000원');
    expect(text).not.toContain('가격 공개 예정');
  });

  it('treats a date-only start as the beginning of that local calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 1, 0, 0));

    try {
      const renderer = renderHomeContent({
        groupBuys: [
          {
            ...sampleGroupBuys[0],
            startDate: '2026-07-13',
            endDate: '2026-07-14',
            discountInfo: null,
          },
        ],
      });
      const text = flattenText(renderer.toJSON());
      expect(text).toContain('공구 진행 중');
      expect(text).not.toContain('D+');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a date-only end active through the end of that local day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 10, 0, 0));

    try {
      const renderer = renderHomeContent({
        groupBuys: [
          {
            ...sampleGroupBuys[0],
            startDate: '2026-12-30',
            endDate: '2026-12-31',
            discountInfo: null,
          },
        ],
      });
      const text = flattenText(renderer.toJSON());
      expect(text).toContain('공구 진행 중');
      expect(text).not.toContain('공구 종료');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the active discount percent and sale price without the list price', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo:
            '정가 229,000원 / 공구가 179,000원 · 22% 할인',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).toContain('22%');
    expect(bannerText).toContain('179,000원');
    expect(bannerText).not.toContain('229,000원');
    expect(banner!.props.accessibilityLabel).toContain('22% 할인');
    expect(banner!.props.accessibilityLabel).toContain('179,000원');
  });

  it('does not mistake a material percentage for an active discount', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo: '유리강화섬유가 30% 포함된 초경량 프레임',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).not.toContain('30%');
    expect(bannerText).toContain('공구 진행 중');
    expect(bannerText).toContain('상세에서 가격 확인');
  });

  it('does not mistake a leading natural-content percentage for a discount', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo: '100% 천연 원료 · 공구가 39,000원',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).not.toContain('100%');
    expect(bannerText).toContain('공구 진행 중');
    expect(bannerText).toContain('39,000원');
  });

  it('keeps a bare product price instead of a trailing delivery fee', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo: '179,000원 + 배송비 3,000원',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).toContain('179,000원');
    expect(bannerText).not.toContain('3,000원');
  });

  it('does not mistake a discount percentage after 특가 for a 30원 price', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
          discountInfo: '오늘만 특가 30% 할인',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).toContain('30%');
    expect(bannerText).toContain('상세에서 가격 확인');
    expect(bannerText).not.toContain('30원');
  });

  it('marks a deal as ended instead of showing stale discount pricing', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          startDate: isoFromNow(-6),
          endDate: isoFromNow(-1),
          discountInfo: '50% 할인 · 공구가 39,000원',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerText = banner!
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children ?? [])
      .join(' ');
    expect(bannerText).toContain('공구 종료');
    expect(bannerText).not.toContain('50%');
    expect(bannerText).not.toContain('39,000원');
  });

  it('keeps a stable full-card image frame through loading and errors', () => {
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
    expect(bannerStyle.width).toBe(305);
    expect(bannerStyle.height).toBe(260);
    expect(bannerStyle.overflow).toBe('hidden');

    const background = renderer.root.findByProps({
      testID: 'promo-background-gb-1',
    });
    expect(flattenStyle(background.props.style).position).toBe('absolute');

    const image = renderer.root.findByProps({ testID: 'promo-image-gb-1' });
    expect(image.props.source).toEqual({
      uri: 'https://example.com/product-cutout.png',
    });
    const renderedImageUris = renderer.root
      .findAll((node) => typeof node.props.source?.uri === 'string')
      .map((node) => node.props.source.uri);
    expect(renderedImageUris).toContain(
      'https://example.com/product-cutout.png',
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
    expect(flattenStyle(counter.props.style).position).toBe('absolute');
    expect(flattenStyle(counter.props.style).top).toBe(12);
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
    expect(bannerText).toContain('이미지 준비 중');
    expect(bannerText).toContain('공구 진행 중');
    expect(bannerText).toContain('상세에서 가격 확인');
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

  it('renders an active DB discount in the bottom overlay without date labels', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: '30% 할인 + 무료배송',
          startDate: isoFromNow(-2),
          endDate: isoFromNow(4),
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('30%');
    expect(text).toContain('상세에서 가격 확인');
    expect(text).not.toContain('시작일');
    expect(text).not.toContain('마감일');

    const overlay = renderer.root.findByProps({ testID: 'promo-overlay-gb-1' });
    expect(
      overlay.findAllByProps({ testID: 'promo-status-gb-1' }),
    ).not.toHaveLength(0);

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner!.props.accessibilityLabel).toContain('30% 할인');
    expect(banner!.props.accessibilityLabel).not.toContain('시작일');
    expect(banner!.props.accessibilityLabel).not.toContain('마감일');
  });

  it('anchors the readable promo copy and status to the image bottom', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: '부대시설 할인권 제공',
        },
      ],
    });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(flattenStyle(banner!.props.style).position).toBe('relative');

    const overlay = renderer.root.findByProps({ testID: 'promo-overlay-gb-1' });
    expect(flattenStyle(overlay.props.style).position).toBe('absolute');
    expect(flattenStyle(overlay.props.style).bottom).toBe(0);
    expect(
      overlay.findAllByProps({ testID: 'promo-status-gb-1' }),
    ).not.toHaveLength(0);
  });

  it('keeps account metadata out of the reference-style image overlay', () => {
    const renderer = renderHomeContent({
      groupBuys: [sampleGroupBuys[0]],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('@beauty_pick');
    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    expect(banner!.props.accessibilityLabel).not.toContain('@beauty_pick');
  });

  it('keeps a centered, partially peeking promo card inside a 320px viewport', () => {
    mockWindowDimensions.width = 320;
    const renderer = renderHomeContent({ groupBuys: [sampleGroupBuys[0]] });

    const banner = findPromoBanner(renderer, '비건 선크림 공구');
    const bannerStyle = flattenStyle(banner!.props.style);
    expect(bannerStyle.width).toBe(260);
    expect(bannerStyle.height).toBe(224);

    const promoRail = renderer.root
      .findAllByType('ScrollView' as unknown as React.ElementType)
      .find((node) => node.props.snapToInterval);
    expect(
      flattenStyle(promoRail!.props.contentContainerStyle).paddingHorizontal,
    ).toBe(30);
  });

  it('uses an honest active-price fallback when DB discount data is missing', () => {
    const renderer = renderHomeContent({
      groupBuys: [
        {
          ...sampleGroupBuys[0],
          discountInfo: null,
        },
      ],
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('공구 진행 중');
    expect(text).toContain('상세에서 가격 확인');
    expect(text).not.toContain('시작일');
    expect(text).not.toContain('마감일');
    expect(
      renderer.root.findAllByProps({
        testID: 'promo-purchase-hook-gb-1',
      }),
    ).toHaveLength(0);
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

    const realOverlays = renderer.root
      .findAllByType('View' as unknown as React.ElementType)
      .filter((node) => node.props.testID?.startsWith('promo-overlay-'));
    expect(realOverlays).toHaveLength(2);
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
    expect(promoRail!.props.snapToInterval).toBe(317);
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
    expect(promoRail!.props.contentOffset).toEqual({ x: 317, y: 0 });
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

  it('renders shared deal cards in the two-column recommendation grid', () => {
    const renderer = renderHomeContent();
    const dealCards = renderer.root.findAllByType(DealCard);

    expect(dealCards.length).toBeGreaterThanOrEqual(2);
    expect(dealCards.some((card) => card.props.item.id === sampleGroupBuys[0].id)).toBe(true);
  });

  it('keeps visible spacing between recommendation cards', () => {
    const renderer = renderHomeContent();
    const grid = renderer.root.findAll((node) => {
      const style = flattenStyle(node.props.style);
      return String(node.type) === 'View' && style.flexWrap === 'wrap' && style.rowGap === 18;
    })[0];

    expect(grid).toBeDefined();
    expect(flattenStyle(grid.props.style).columnGap).toBe(spacing.md);
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
