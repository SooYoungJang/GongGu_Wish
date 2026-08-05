import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchScreen } from './SearchScreen';
import type { GroupBuy, Influencer } from '../types';

const mocks = vi.hoisted(() => {
  const groupBuy: GroupBuy = {
    id: 'gb-1',
    productName: '뒤척임 제로 경추 베개, 그레이, 74...',
    brandName: '베스트베개',
    category: 'living',
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
	    groupBuy,
	    groupBuys: [groupBuy],
	    groupBuysError: false,
	    groupBuysFetching: false,
	    groupBuysRefetch: vi.fn(),
	    influencer,
	    influencers: [influencer],
	    influencersError: false,
	    influencersFetching: false,
	    influencersRefetch: vi.fn(),
	    popularTerms: [{ keyword: '베개', rank: 1, count: 8 }],
	    popularTermsRefetch: vi.fn(),
	    logSearchTerm: vi.fn(() => Promise.resolve()),
	    requestGroupBuy: vi.fn(() => Promise.resolve({
	      requestId: 'request-1',
	      productName: '없는 공구',
	      requestCount: 1,
	      alreadyRequested: false,
	      rankingEligible: false,
	    })),
	    requestPending: false,
	    invalidateQueries: vi.fn(() => Promise.resolve()),
	    recentGetItem: vi.fn(() => Promise.resolve(JSON.stringify(['가방']))),
	    recentSetItem: vi.fn(() => Promise.resolve()),
	    canRecordBehaviorSignals: true,
	    canGoBack: vi.fn(() => true),
	    navigate: vi.fn(),
	    goBack: vi.fn(),
	    routeParams: undefined as { initialQuery?: string } | undefined,
	  };
});

vi.mock('../features/groupBuyRequests', () => ({
  GROUP_BUY_REQUEST_RANKINGS_QUERY_KEY: ['group-buy-request-rankings'],
  requestGroupBuy: mocks.requestGroupBuy,
}));

vi.mock('../api', () => ({
	  fetchGroupBuys: vi.fn(),
	  fetchInfluencers: vi.fn(),
	  fetchPopularSearchTerms: vi.fn(),
	  logSearchTerm: mocks.logSearchTerm,
	  searchInfluencers: (influencers: Influencer[], query: string) => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return influencers.filter((influencer) =>
      influencer.instagramUsername.toLowerCase().includes(q) ||
      (influencer.displayName ?? '').toLowerCase().includes(q),
    );
  },
}));

vi.mock('../audience/behaviorSignalsPolicy', () => ({
  canRecordBehaviorSignals: () => mocks.canRecordBehaviorSignals,
}));

vi.mock('../audience/AudienceContext', () => ({
  useAudience: () => ({
    policy: {
      canRecordBehaviorSignals: mocks.canRecordBehaviorSignals,
    },
  }),
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
	    if (queryKey[0] === 'group-buys') return {
	      data: mocks.groupBuys,
	      isError: mocks.groupBuysError,
	      isFetching: mocks.groupBuysFetching,
	      refetch: mocks.groupBuysRefetch,
	    };
	    if (queryKey[0] === 'popular-search-terms') return {
	      data: mocks.popularTerms,
	      refetch: mocks.popularTermsRefetch,
	    };
	    return {
	      data: mocks.influencers,
	      isError: mocks.influencersError,
	      isFetching: mocks.influencersFetching,
	      refetch: mocks.influencersRefetch,
	    };
	  },
	  useMutation: () => ({
	    isPending: mocks.requestPending,
	    mutateAsync: mocks.requestGroupBuy,
	  }),
	  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
	}));

vi.mock('@react-navigation/native', () => ({
	  useNavigation: () => ({
	    navigate: mocks.navigate,
	    goBack: mocks.goBack,
	    canGoBack: mocks.canGoBack,
	  }),
  useRoute: () => ({ params: mocks.routeParams }),
  useFocusEffect: vi.fn((cb: any) => {
    if (typeof cb === 'function') cb();
    return vi.fn();
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.recentGetItem,
    setItem: mocks.recentSetItem,
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

	  const TextInput = ReactMock.forwardRef((props: any, ref: React.Ref<{ focus: () => void; blur: () => void }>) => {
	    ReactMock.useImperativeHandle(ref, () => ({ focus: vi.fn(), blur: vi.fn() }));
	    return ReactMock.createElement('TextInput', props, props.placeholder);
	  });

	  return {
	    Image: passthrough('Image'),
	    InteractionManager: {
	      runAfterInteractions: vi.fn((callback: () => void) => {
	        callback();
	        return { cancel: vi.fn() };
	      }),
	    },
	    StatusBar: passthrough('StatusBar'),
	    Switch: (props: any) => ReactMock.createElement('Switch', props),
	    Pressable: ({ children, ...props }: any) =>
	      ReactMock.createElement('Pressable', props, children),
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
  beforeEach(() => {
    mocks.groupBuys = [mocks.groupBuy];
    mocks.groupBuysError = false;
    mocks.groupBuysFetching = false;
    mocks.influencers = [mocks.influencer];
    mocks.influencersError = false;
    mocks.influencersFetching = false;
    mocks.groupBuysRefetch.mockClear();
    mocks.influencersRefetch.mockClear();
    mocks.popularTermsRefetch.mockClear();
	    mocks.logSearchTerm.mockClear();
	    mocks.requestGroupBuy.mockClear();
	    mocks.requestGroupBuy.mockResolvedValue({
	      requestId: 'request-1',
	      productName: '없는 공구',
	      requestCount: 1,
	      alreadyRequested: false,
	      rankingEligible: false,
	    });
	    mocks.requestPending = false;
	    mocks.invalidateQueries.mockClear();
	    mocks.recentGetItem.mockClear();
	    mocks.recentSetItem.mockClear();
	    mocks.canRecordBehaviorSignals = true;
	    mocks.navigate.mockClear();
	    mocks.goBack.mockClear();
	    mocks.routeParams = undefined;
  });

  it('shows a shared retry state when search sources fail without cache', async () => {
    mocks.groupBuys = [];
    mocks.influencers = [];
    mocks.groupBuysError = true;
    const renderer = await renderSearchScreen();
    const notice = renderer.root.find(
      (node) =>
        node.props.testID === 'search-query-state' &&
        node.props.accessibilityLiveRegion,
    );

    expect(notice.props.accessibilityLiveRegion).toBe('assertive');
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: '다시 불러오기' })
        .props.onPress();
    });
    expect(mocks.groupBuysRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.influencersRefetch).toHaveBeenCalledTimes(1);
  });

  it('keeps cached search sources visible with a stale notice', async () => {
    mocks.groupBuysError = true;
    const renderer = await renderSearchScreen();
    const notice = renderer.root.find(
      (node) =>
        node.props.testID === 'search-query-state' &&
        node.props.accessibilityLiveRegion,
    );

    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    expect(flattenText(renderer.toJSON())).toContain('베개');
  });

  it('renders the reference-style empty search layout', async () => {
    const renderer = await renderSearchScreen();
    const text = flattenText(renderer.toJSON());

	    expect(text).toContain('상품을 검색해보세요');
	    expect(text).toContain('최근 검색어');
	    expect(text).toContain('가방');
	    expect(text).toContain('인기 검색어');
	    expect(text).toContain('베개');
	    expect(text).not.toContain('최근 본 상품');
	    expect(text).not.toContain('취소');
	  });

	  it('keeps back and popular search actions wired', async () => {
	    const renderer = await renderSearchScreen();

	    act(() => {
	      renderer.root.findByProps({ accessibilityLabel: '뒤로가기' }).props.onPress();
	      renderer.root.findByProps({ accessibilityLabel: '인기 검색어 1위 베개' }).props.onPress();
	    });

	    expect(mocks.goBack).toHaveBeenCalledTimes(1);
	    expect(mocks.logSearchTerm).not.toHaveBeenCalled();
	    expect(renderer.root.findByProps({ accessibilityLabel: '검색어 지우기' })).toBeTruthy();
	  });

	  it('stores a submitted query as recent without adding it to popular searches', async () => {
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    await act(async () => {
	      input.props.onChangeText('내맘대로 검색어');
	      await Promise.resolve();
	    });
	    act(() => {
	      input.props.onSubmitEditing();
	    });

	    expect(mocks.recentSetItem).toHaveBeenCalledWith(
	      'search:recent',
	      expect.stringContaining('내맘대로 검색어'),
	    );
	    expect(mocks.logSearchTerm).not.toHaveBeenCalled();
	  });

	  it('does not read or write search history when behavior signals are blocked', async () => {
	    mocks.canRecordBehaviorSignals = false;
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => {
	      input.props.onChangeText('13세 검색어');
	      input.props.onSubmitEditing();
	    });

	    expect(mocks.recentGetItem).not.toHaveBeenCalled();
	    expect(mocks.recentSetItem).not.toHaveBeenCalled();
	    expect(mocks.logSearchTerm).not.toHaveBeenCalled();
	  });

	  it('adds the selected product name to popular searches', async () => {
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => {
	      input.props.onChangeText('뒤척임');
	    });
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    act(() => {
	      renderer.root
	        .findByProps({ accessibilityLabel: `${mocks.groupBuy.productName} 보기` })
	        .props.onPress();
	    });

	    expect(mocks.logSearchTerm).toHaveBeenCalledTimes(1);
	    expect(mocks.logSearchTerm).toHaveBeenCalledWith(
	      mocks.groupBuy.productName,
	      mocks.groupBuy.id,
	    );
	    expect(mocks.recentSetItem).toHaveBeenCalledWith(
	      'search:recent',
	      expect.stringContaining('뒤척임'),
	    );
	    expect(mocks.navigate).toHaveBeenCalledWith('Detail', { groupBuy: mocks.groupBuy });
	  });

	  it('waits 250ms after typing before updating search results', async () => {
	    vi.useFakeTimers();
	    try {
	      mocks.groupBuys = [];
	      mocks.influencers = [];
	      const renderer = await renderSearchScreen();
	      const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	      act(() => {
	        input.props.onChangeText('없는 공구');
	      });
	      await act(async () => {
	        await vi.advanceTimersByTimeAsync(249);
	      });

	      expect(
	        renderer.root.findAllByProps({ accessibilityLabel: '없는 공구 공구 요청하기' }),
	      ).toHaveLength(0);

	      await act(async () => {
	        await vi.advanceTimersByTimeAsync(1);
	      });

	      expect(
	        renderer.root.findByProps({ accessibilityLabel: '없는 공구 공구 요청하기' }),
	      ).toBeTruthy();
	    } finally {
	      vi.clearAllTimers();
	      vi.useRealTimers();
	    }
	  });

	  it('does not accumulate a missing search until the request button is pressed', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => {
	      input.props.onChangeText('없는 공구');
	    });
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });

	    expect(mocks.requestGroupBuy).not.toHaveBeenCalled();
	    expect(
	      renderer.root.findByProps({ accessibilityLabel: '없는 공구 공구 요청하기' }),
	    ).toBeTruthy();
	    expect(flattenText(renderer.toJSON())).toContain('없는 공구');
    expect(flattenText(renderer.toJSON())).toContain('공구를 요청할까요?');
	    expect(flattenText(renderer.toJSON())).not.toContain('⌕');
	    expect(flattenText(renderer.toJSON())).not.toContain('검색 결과가 없어요');
	    expect(flattenText(renderer.toJSON())).not.toContain(
	      '브랜드명, 제품명 또는 인플루언서 username을 다시 확인해 주세요.',
	    );
	    expect(flattenText(renderer.toJSON())).not.toContain(
	      '로그인하지 않아도 최근 한 달 요청에 반영돼요.',
	    );
	  });

	  it('names the searched product in the missing-result request title and action', async () => {
    mocks.groupBuys = [];
    mocks.influencers = [];
    const renderer = await renderSearchScreen();
    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

    act(() => {
      input.props.onChangeText('  없는   공구  ');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('“없는 공구”');
    expect(text).toContain('공구를 요청할까요?');
    expect(text).toContain('“없는 공구” 공구 요청하기');
  });

  it('asks only for a product name of at least two characters', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });
	    expect(input.props.maxLength).toBe(200);

	    act(() => {
	      input.props.onChangeText('가');
	    });
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });

	    const text = flattenText(renderer.toJSON());
	    expect(text).toContain('상품명은 2자 이상으로 입력해 주세요.');
	    expect(text).not.toContain('60자 이하');
	  });

	  it('submits a missing group-buy request and refreshes the monthly ranking', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => {
	      input.props.onChangeText('없는 공구');
	    });
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    await act(async () => {
	      await renderer.root
	        .findByProps({ accessibilityLabel: '없는 공구 공구 요청하기' })
	        .props.onPress();
	    });

	    expect(mocks.requestGroupBuy).toHaveBeenCalledWith('없는 공구');
	    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
	      queryKey: ['group-buy-request-rankings'],
	    });
	    expect(flattenText(renderer.toJSON())).toContain('공구 요청 완료');
	    expect(flattenText(renderer.toJSON())).toContain('요청 2건부터 홈 순위 후보에 표시돼요.');
	  });

	  it('disables missing group-buy requests when behavior signals are blocked', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.canRecordBehaviorSignals = false;
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => {
	      input.props.onChangeText('없는 공구');
	    });
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });

	    const requestButton = renderer.root.findByProps({
	      accessibilityLabel: '없는 공구 공구 요청하기',
	    });
	    expect(requestButton.props.disabled).toBe(true);
	    expect(flattenText(renderer.toJSON())).toContain('현재 이용 모드에서는 공구 요청을 사용할 수 없어요.');
	    expect(mocks.requestGroupBuy).not.toHaveBeenCalled();
	  });

	  it('prefills the query received from the home request ranking', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.routeParams = { initialQuery: '홈에서 선택한 공구' };

	    const renderer = await renderSearchScreen();
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });

	    expect(renderer.root.findByProps({ accessibilityLabel: '공구 검색' }).props.value)
	      .toBe('홈에서 선택한 공구');
	    expect(renderer.root.findByProps({
	      accessibilityLabel: '홈에서 선택한 공구 공구 요청하기',
	    })).toBeTruthy();
	  });

	  it('caps a programmatic search prefill at the shared product-name limit', async () => {
	    const overlongQuery = '가'.repeat(201);
	    mocks.routeParams = { initialQuery: overlongQuery };
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    expect(input.props.value).toBe('가'.repeat(200));
	    expect(input.props.maxLength).toBe(200);
	  });

	  it('keeps server-distinct spacing variants as separate request states', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.requestGroupBuy.mockResolvedValue({
	      requestId: 'request-spaced',
	      productName: '에어 팟',
	      requestCount: 1,
	      alreadyRequested: false,
	      rankingEligible: false,
	    });
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => input.props.onChangeText('에어 팟'));
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    await act(async () => {
	      await renderer.root
	        .findByProps({ accessibilityLabel: '에어 팟 공구 요청하기' })
	        .props.onPress();
	    });
	    act(() => input.props.onChangeText('에어팟'));
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });

	    expect(
	      renderer.root.findByProps({ accessibilityLabel: '에어팟 공구 요청하기' })
	        .props.disabled,
	    ).toBe(false);
	  });

	  it('shows a busy disabled request action and prevents a duplicate submit', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.requestPending = true;
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => input.props.onChangeText('대기 공구'));
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    const button = renderer.root.findByProps({
	      accessibilityLabel: '대기 공구 공구 요청하기',
	    });

	    expect(button.props.disabled).toBe(true);
	    expect(button.props.accessibilityState.busy).toBe(true);
	    expect(flattenText(renderer.toJSON())).toContain('요청하는 중…');
	    await act(async () => {
	      await button.props.onPress();
	    });
	    expect(mocks.requestGroupBuy).not.toHaveBeenCalled();
	  });

	  it('shows an already-requested completion without incrementing again', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.requestGroupBuy.mockResolvedValue({
	      requestId: 'request-existing',
	      productName: '기존 요청 공구',
	      requestCount: 4,
	      alreadyRequested: true,
	      rankingEligible: true,
	    });
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => input.props.onChangeText('기존 요청 공구'));
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    await act(async () => {
	      await renderer.root
	        .findByProps({ accessibilityLabel: '기존 요청 공구 공구 요청하기' })
	        .props.onPress();
	    });

	    expect(mocks.requestGroupBuy).toHaveBeenCalledTimes(1);
	    expect(flattenText(renderer.toJSON())).toContain('이미 요청했어요');
	    expect(flattenText(renderer.toJSON())).toContain(
	      '최근 한 달 요청에 이미 반영된 공구예요.',
	    );
	  });

	  it('shows a request error and retries successfully', async () => {
	    mocks.groupBuys = [];
	    mocks.influencers = [];
	    mocks.requestGroupBuy.mockRejectedValueOnce(new Error('network'));
	    const renderer = await renderSearchScreen();
	    const input = renderer.root.findByProps({ accessibilityLabel: '공구 검색' });

	    act(() => input.props.onChangeText('재시도 공구'));
	    await act(async () => {
	      await new Promise((resolve) => setTimeout(resolve, 300));
	    });
	    const requestButton = () =>
	      renderer.root.findByProps({
	        accessibilityLabel: '재시도 공구 공구 요청하기',
	      });
	    await act(async () => {
	      await requestButton().props.onPress();
	    });

	    expect(flattenText(renderer.toJSON())).toContain('공구 요청에 실패했어요.');
	    expect(flattenText(renderer.toJSON())).toContain('다시 요청하기');

	    mocks.requestGroupBuy.mockResolvedValueOnce({
	      requestId: 'request-retry',
	      productName: '재시도 공구',
	      requestCount: 2,
	      alreadyRequested: false,
	      rankingEligible: true,
	    });
	    await act(async () => {
	      await requestButton().props.onPress();
	    });

	    expect(mocks.requestGroupBuy).toHaveBeenCalledTimes(2);
	    expect(flattenText(renderer.toJSON())).toContain('공구 요청 완료');
	    expect(flattenText(renderer.toJSON())).toContain(
	      '최근 한 달 홈 순위 후보에 반영됐어요.',
	    );
	  });
});
