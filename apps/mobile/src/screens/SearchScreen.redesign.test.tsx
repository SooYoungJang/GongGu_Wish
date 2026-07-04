import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { SearchScreen } from './SearchScreen';
import type { GroupBuy, Influencer } from '../types';

const mocks = vi.hoisted(() => {
  const groupBuy: GroupBuy = {
    id: 'gb-1',
    productName: '뒤척임 제로 경추 베개, 그레이, 74...',
    brandName: '베스트베개',
    category: 'lifestyle',
    startDate: null,
    endDate: null,
    purchaseUrl: 'https://example.com',
    discountInfo: '41% 특가',
    summary: '편안한 경추 베개입니다.',
    confidence: 0.92,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: { postUrl: 'https://instagram.com/p/1', influencer: { instagramUsername: 'pillow_shop' } },
  };
  const influencer: Influencer = {
    id: 'inf-1',
    instagramUsername: 'pillow_shop',
    displayName: '필로우샵',
    isActive: true,
  };
  return {
    groupBuys: [groupBuy],
    influencers: [influencer],
    navigate: vi.fn(),
    goBack: vi.fn(),
  };
});

vi.mock('../api', () => ({
  fallbackGroupBuys: mocks.groupBuys,
  fetchGroupBuys: vi.fn(),
  fetchInfluencers: vi.fn(),
  searchInfluencers: (influencers: Influencer[], query: string) => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return influencers.filter((influencer) =>
      influencer.instagramUsername.toLowerCase().includes(q) ||
      (influencer.displayName ?? '').toLowerCase().includes(q),
    );
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
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      textTertiary: '#9CA3AF',
      textInverse: '#FFFFFF',
      badgeText: '#007AFF',
      noticeText: '#333333',
      warningBg: '#FFF8E1',
      error: '#FF3B30',
      errorBg: '#FFEBEE',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      shadow: '#000000',
      divider: '#E5E7EB',
      ctaPurple: '#6C63FF',
      ctaPurpleText: '#FFFFFF',
    } as any,
    shadows: {} as any,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'group-buys') return { data: mocks.groupBuys };
    return { data: mocks.influencers };
  },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mocks.navigate,
    goBack: mocks.goBack,
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(JSON.stringify(['가방']))),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

vi.mock('../components/keyboard/KeyboardFormScreen', () => {
  const ReactMock = require('react');
  return {
    KeyboardFormScreen: ({ children, contentContainerStyle }: { children?: React.ReactNode; contentContainerStyle?: unknown }) =>
      ReactMock.createElement('KeyboardFormScreen', { contentContainerStyle }, children),
  };
});

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement(type, props, children);

  const TextInput = ReactMock.forwardRef((props: any, ref: React.Ref<{ focus: () => void }>) => {
    ReactMock.useImperativeHandle(ref, () => ({ focus: vi.fn() }));
    return ReactMock.createElement('TextInput', props, props.placeholder);
  });

  return {
    Image: passthrough('Image'),
    Pressable: ({ children, onPress, style, accessibilityLabel, accessibilityRole }: any) =>
      ReactMock.createElement('Pressable', { onPress, style, accessibilityLabel, accessibilityRole }, children),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement('Text', props, children),
    TextInput,
    View: ({ children, ...props }: { children?: React.ReactNode }) => ReactMock.createElement('View', props, children),
  };
});

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

async function renderSearchScreen() {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SearchScreen />);
    await Promise.resolve();
  });
  return renderer!;
}

describe('SearchScreen redesign', () => {
  it('renders the reference-style empty search layout', async () => {
    const renderer = await renderSearchScreen();
    const text = flattenText(renderer.toJSON());

    expect(text).toContain('상품을 검색해보세요');
    expect(text).toContain('최근 검색어');
    expect(text).toContain('가방');
    expect(text).toContain('최근 본 상품');
    expect(text).toMatch(/41%\s+특가/);
    expect(text).toContain('14,652원');
    expect(text).toContain('베스트판매자');
    expect(text).not.toContain('인기 검색어');
    expect(text).not.toContain('취소');
  });

  it('keeps back and product navigation actions wired', async () => {
    const renderer = await renderSearchScreen();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '뒤로가기' }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: '뒤척임 제로 경추 베개, 그레이, 74... 최근 본 상품 보기' }).props.onPress();
    });

    expect(mocks.goBack).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('Detail', { groupBuy: mocks.groupBuys[0] });
  });
});
