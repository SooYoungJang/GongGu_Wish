import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { FeedPost, FeedPostListResponse, GroupBuy, Influencer, InstagramMediaInfo, Submission } from './types';
export { searchInfluencers } from './utils/search';

// ─── API Error Types ─────────────────────────────────────────────────────────

export interface ApiValidationError {
  field: string;
  message: string;
  code: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: ApiValidationError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isValidationError(): boolean {
    return this.status === 400 && Array.isArray(this.errors);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/* ── Local types for fetchSellerRankings (avoids feature -> shared dependency) ── */
export type RankingCategory =
  | 'all' | 'beauty' | 'fashion' | 'food' | 'lifestyle' | 'baby' | 'digital';
export type RankingPeriod = 'today' | 'weekly' | 'monthly';
export type RankingSort = 'popular' | 'rising' | 'deadlineSoon' | 'newDeal' | 'brand';
export type RankingTrend =
  | { kind: 'up'; delta: number }
  | { kind: 'down'; delta: number }
  | { kind: 'same' }
  | { kind: 'new' };
export type RankingThumbnail = {
  id: string;
  imageUrl: string | null;
  label?: string | null;
  groupBuyId?: string | null;
};
export type SellerRanking = {
  id: string;
  sellerId: string;
  rank: number;
  previousRank: number | null;
  trend: RankingTrend;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  category: Exclude<RankingCategory, 'all'>;
  followerCount?: number | null;
  activeDealCount: number;
  endingSoonCount?: number | null;
  trustScore?: number | null;
  isFollowing: boolean;
  isSponsored: boolean;
  thumbnails: RankingThumbnail[];
  representativeGroupBuyId?: string | null;
};
export type SellerRankingQuery = {
  tab: 'ranking' | 'following';
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
};

export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3003/api/v1',
  ios: 'http://localhost:3003/api/v1',
  default: 'http://192.168.219.122:3003/api/v1',
});

export const fallbackGroupBuys: GroupBuy[] = [
  {
    id: 'sample-1',
    productName: '비건 선크림 공구',
    brandName: 'Sample Beauty',
    endDate: '2026-06-15T23:59:59+09:00',
    purchaseUrl: 'https://example.com',
    discountInfo: '20% 할인',
    summary: '인플루언서 게시물에서 감지된 공동구매 후보입니다.',
    confidence: 0.82,
    rawPost: {
      postUrl: 'https://www.instagram.com/',
      influencer: {
        instagramUsername: 'sample_influencer',
      },
    },
  },
  {
    id: 'sample-2',
    productName: '프리미엄 유아용품 세트',
    brandName: '맘편한세상',
    endDate: '2026-07-01T23:59:59+09:00',
    purchaseUrl: 'https://example.com/baby',
    discountInfo: '35% 할인',
    summary: '신생아부터 돌까지 필요한 유아용품을 한 번에.',
    confidence: 0.91,
    rawPost: {
      postUrl: 'https://www.instagram.com/',
      influencer: {
        instagramUsername: 'mom_blogger',
      },
    },
  },
  {
    id: 'sample-3',
    productName: '올인원 홈트레이닝 키트',
    brandName: '핏스타그램',
    endDate: '2026-06-28T23:59:59+09:00',
    purchaseUrl: 'https://example.com/fitness',
    discountInfo: '25% 할인',
    summary: '홈트레이닝에 필요한 모든 도구를 세트로.',
    confidence: 0.78,
    rawPost: {
      postUrl: 'https://www.instagram.com/',
      influencer: {
        instagramUsername: 'fitness_influencer',
      },
    },
  },
  {
    id: 'sample-4',
    productName: '스마트 홈 카메라',
    brandName: '테크스토어',
    endDate: '2026-06-20T23:59:59+09:00',
    purchaseUrl: 'https://example.com/camera',
    discountInfo: '15% 할인',
    summary: '반려동물, 아이 모니터링에 최적화된 스마트 카메라.',
    confidence: 0.85,
    rawPost: {
      postUrl: 'https://www.instagram.com/',
      influencer: {
        instagramUsername: 'tech_reviewer',
      },
    },
  },
  {
    id: 'sample-5',
    productName: '자연유래 클렌징 3종 세트',
    brandName: '글로우스킨',
    endDate: '2026-07-10T23:59:59+09:00',
    purchaseUrl: 'https://example.com/skincare',
    discountInfo: '30% 할인',
    summary: '민감성 피부를 위한 저자극 클렌징 라인.',
    confidence: 0.88,
    rawPost: {
      postUrl: 'https://www.instagram.com/',
      influencer: {
        instagramUsername: 'skincare_expert',
      },
    },
  },
];

export async function fetchGroupBuys() {
  const response = await fetch(`${API_BASE_URL}/group-buys`);

  if (!response.ok) {
    throw new Error('API unavailable');
  }

  return (await response.json()) as GroupBuy[];
}

export async function fetchFeeds(page = 1, limit = 20): Promise<FeedPostListResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/feeds?page=${page}&limit=${limit}`);

    if (!response.ok) {
      const body = await response.text();
      console.log('[Feed] HTTP error:', response.status, body.substring(0, 300));
      throw new Error('Feeds API unavailable');
    }

    const data = (await response.json()) as FeedPostListResponse;
    console.log('[Feed] success, items:', data?.items?.length);
    return data;
  } catch (error) {
    console.log('[Feed] fetch failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function fetchFeedPost(id: string): Promise<FeedPost> {
  const response = await fetch(`${API_BASE_URL}/feeds/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error('Feed post API unavailable');
  }

  return (await response.json()) as FeedPost;
}

export async function fetchSellerRankings(query: SellerRankingQuery): Promise<SellerRanking[]> {
  const params = new URLSearchParams({
    tab: query.tab,
    category: query.category,
    period: query.period,
    sort: query.sort,
  });
  const response = await fetch(`${API_BASE_URL}/ranking/sellers?${params}`);

  if (!response.ok) {
    throw new Error('Seller rankings API unavailable');
  }

  const body = (await response.json()) as { data: SellerRanking[] };
  return body.data;
}

export async function fetchInfluencers() {
  const response = await fetch(`${API_BASE_URL}/influencers`);

  if (!response.ok) {
    throw new Error('Influencers API unavailable');
  }

  return (await response.json()) as Influencer[];
}

export async function fetchGroupBuysByInfluencer(instagramUsername: string) {
  const normalizedUsername = instagramUsername.replace(/^@/, '').toLowerCase();
  const groupBuys = await fetchGroupBuys();

  return groupBuys.filter(
    (item) => item.rawPost.influencer.instagramUsername.replace(/^@/, '').toLowerCase() === normalizedUsername,
  );
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('gonggu.authToken');
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync('gonggu.authToken', token);
  } catch {
    // ignore
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('gonggu.authToken');
  } catch {
    // ignore
  }
}

export function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Note: In actual implementation, this would be async and we'd need to handle it differently
  // For now, we'll use a synchronous approach for web (localStorage) and async for native
  if (Platform.OS === 'web') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = (typeof window !== 'undefined' && window.localStorage?.getItem('gonggu.authToken')) as string | null;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // localStorage not available (e.g., SSR)
    }
  }

  return headers;
}

export async function fetchAdminJson<T>(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Admin API failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchAdminSubmissions() {
  const statuses: Submission['status'][] = ['REVIEW_REQUIRED', 'APPROVED', 'REJECTED'];
  const groups = await Promise.all(
    statuses.map((status) => fetchAdminJson<Submission[]>(`/admin/submissions?status=${status}&limit=50`)),
  );

  return groups.flat();
}

export async function patchAdminJson<T>(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Admin API failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function deleteAdminJson<T>(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Admin API failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function postAdminJson<T>(path: string, body?: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Admin API failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function postPublicJson<T>(path: string, body: unknown) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network error (fetch itself threw)
    throw new ApiError(0, '네트워크 연결을 확인해주세요.');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');

    // Try to parse structured error with validation details (400 from Zod pipe)
    if (response.status === 400) {
      try {
        const parsed = JSON.parse(errorText) as {
          message: string;
          errors?: Array<{ field: string; message: string; code: string }>;
        };
        if (parsed.errors) {
          throw new ApiError(400, parsed.message || '입력값을 확인해주세요.', parsed.errors);
        }
      } catch {
        // fall through to generic error below
      }
    }

    const displayMessage =
      response.status === 429
        ? '잠시 후 다시 시도해주세요.'
        : errorText || `Public API failed: ${response.status}`;

    throw new ApiError(response.status, displayMessage);
  }

  return (await response.json()) as T;
}

/**
 * Look up Instagram post metadata via HikerAPI.
 * POST /api/v1/hiker-api/lookup
 *
 * Returns post image, caption, like count, username, and taken-at date.
 */
export async function lookupInstagramUrl(url: string): Promise<InstagramMediaInfo> {
  const response = await fetch(`${API_BASE_URL}/hiker-api/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `HikerAPI lookup failed: ${response.status}`);
  }

  return (await response.json()) as InstagramMediaInfo;
}
