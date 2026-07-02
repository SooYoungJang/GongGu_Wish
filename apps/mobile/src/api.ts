/**
 * @gonggu/mobile — API Layer
 *
 * Refactored for Supabase PostgREST:
 * - Public data endpoints → PostgREST direct (GET /rest/v1/...)
 * - Edge Function endpoints → POST /functions/v1/...
 * - Admin CRUD → Edge Function (service_role)
 * - postPublicJson('/submissions') → Supabase Edge Function
 *
 * All existing function signatures are preserved for consumer compatibility.
 */

import { Platform } from 'react-native';

import type { FeedPost, FeedPostListResponse, GroupBuy, Influencer, InstagramMediaInfo, Submission } from './types';
export { searchInfluencers } from './utils/search';

import { postgrestGet, callEdgeFunction } from './lib/postgrest-client';
import { ApiError, type ApiValidationError } from './lib/api-types';

// ─── Re-export ApiError for consumers that import it ─────────────────────────
export type { ApiValidationError } from './lib/api-types';
export { ApiError } from './lib/api-types';

// ─── Ranking types (mobile-specific) ─────────────────────────────────────────

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

// ─── NestJS URL (kept for postPublicJson) ────────────────────────────────────

export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3003/api/v1',
  ios: 'http://localhost:3003/api/v1',
  default: 'http://192.168.219.122:3003/api/v1',
}) as string;

// ─── Sample Data ─────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC DATA — PostgREST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all group buys with raw post details.
 * GET /rest/v1/group_buys?select=*,raw_post_id(*)
 */
export async function fetchGroupBuys(): Promise<GroupBuy[]> {
  try {
    const { data } = await postgrestGet<any[]>('group_buys?select=*,raw_post_id(*,influencer_id(*))&order=created_at.desc');
    // PostgREST returns raw_post_id and influencer_id as nested objects.
    // Transform to match the app's GroupBuy type which expects rawPost.influencer.instagramUsername.
    return (data || []).map((item) => ({
      id: item.id,
      productName: item.productName ?? null,
      brandName: item.brandName ?? null,
      endDate: item.endDate ?? null,
      purchaseUrl: item.purchaseUrl ?? null,
      discountInfo: item.discountInfo ?? null,
      summary: item.summary ?? null,
      confidence: item.confidence ?? 0,
      rawPost: {
        postUrl: item.rawPostId?.postUrl ?? '',
        influencer: {
          instagramUsername: item.rawPostId?.influencerId?.instagramUsername ?? '',
        },
      },
    })) as GroupBuy[];
  } catch (error) {
    console.log('[GroupBuys] fetch failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Fetch paginated feed posts.
 * GET /rest/v1/feed_posts + Range header + count=exact
 */
export async function fetchFeeds(page = 1, limit = 20): Promise<FeedPostListResponse> {
  try {
    const { data, meta } = await postgrestGet<FeedPost[]>('feed_posts', {
      pagination: { page, limit },
    });
    return {
      items: data,
      meta: meta ?? { total: 0, page, limit, totalPages: 0 },
    };
  } catch (error) {
    console.log('[Feed] fetch failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Fetch a single feed post by ID.
 * GET /rest/v1/feed_posts?id=eq.{id}
 */
export async function fetchFeedPost(id: string): Promise<FeedPost> {
  const { data } = await postgrestGet<FeedPost[]>('feed_posts', undefined);
  const post = Array.isArray(data) ? data.find((p) => p.id === id) : undefined;
  if (!post) {
    throw new ApiError(404, 'Feed post not found');
  }
  return post;
}

/**
 * Fetch all influencers.
 * GET /rest/v1/influencers
 */
export async function fetchInfluencers(): Promise<Influencer[]> {
  const { data } = await postgrestGet<Influencer[]>('influencers');
  return data;
}

/**
 * Fetch group buys filtered by influencer username.
 * Uses PostgREST with embedded filter on raw_post -> influencer.
 */
export async function fetchGroupBuysByInfluencer(instagramUsername: string): Promise<GroupBuy[]> {
  const normalizedUsername = instagramUsername.replace(/^@/, '').toLowerCase();
  const { data } = await postgrestGet<any[]>(
    `group_buys?select=*,raw_post_id(*,influencer_id(*))&raw_post_id.influencer_id.instagram_username=eq.${normalizedUsername}`,
  );
  return (data || []).map((item) => ({
    id: item.id,
    productName: item.productName ?? null,
    brandName: item.brandName ?? null,
    endDate: item.endDate ?? null,
    purchaseUrl: item.purchaseUrl ?? null,
    discountInfo: item.discountInfo ?? null,
    summary: item.summary ?? null,
    confidence: item.confidence ?? 0,
    rawPost: {
      postUrl: item.rawPostId?.postUrl ?? '',
      influencer: {
        instagramUsername: item.rawPostId?.influencerId?.instagramUsername ?? '',
      },
    },
  })) as GroupBuy[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTIONS — callEdgeFunction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch seller rankings.
 * POST /functions/v1/seller-rankings
 */
export async function fetchSellerRankings(query: SellerRankingQuery): Promise<SellerRanking[]> {
  const body = await callEdgeFunction<{ data: SellerRanking[] }>('seller-rankings', query);
  return body.data;
}

/**
 * Look up Instagram post metadata via HikerAPI Edge Function.
 * POST /functions/v1/hiker-lookup
 */
export async function lookupInstagramUrl(url: string): Promise<InstagramMediaInfo> {
  return callEdgeFunction<InstagramMediaInfo>('hiker-lookup', { url });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Edge Function (service_role)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch admin JSON data via admin-api Edge Function.
 * POST /functions/v1/admin-api
 */
async function adminFetch<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  return callEdgeFunction<T>('admin-api', { path, method, body });
}

export async function fetchAdminJson<T>(path: string) {
  return adminFetch<T>(path);
}

export async function fetchAdminSubmissions() {
  const statuses: Submission['status'][] = ['REVIEW_REQUIRED', 'APPROVED', 'REJECTED'];
  const groups: Submission[][] = [];
  for (const status of statuses) {
    const result = await adminFetch<Submission[]>(`/submissions?status=${status}&limit=50`);
    groups.push(result);
  }
  return groups.flat();
}

export async function patchAdminJson<T>(path: string, payload: unknown) {
  return adminFetch<T>(path, 'PATCH', payload);
}

export async function deleteAdminJson<T>(path: string) {
  return adminFetch<T>(path, 'DELETE');
}

export async function postAdminJson<T>(path: string, payload?: unknown) {
  return adminFetch<T>(path, 'POST', payload);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC WRITE — Edge Function for submissions, NestJS fallback for legacy paths
// ═══════════════════════════════════════════════════════════════════════════════

const PUBLIC_SUBMISSION_TIMEOUT_MS = 15_000;

async function postPublicSubmission<T>(body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUBLIC_SUBMISSION_TIMEOUT_MS);

  try {
    return await callEdgeFunction<T>('public-submission', body, { signal: controller.signal });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, '요청 시간이 초과됐습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
    }
    throw new ApiError(0, '네트워크 연결을 확인해주세요.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postPublicJson<T>(path: string, body: unknown) {
  if (path === '/submissions') {
    return postPublicSubmission<T>(body);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, '네트워크 연결을 확인해주세요.');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');

    if (response.status === 400) {
      try {
        const parsed = JSON.parse(errorText) as {
          message: string;
          errors?: ApiValidationError[];
        };
        if (parsed.errors) {
          throw new ApiError(400, parsed.message || '입력값을 확인해주세요.', parsed.errors);
        }
      } catch {
        // fall through
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
