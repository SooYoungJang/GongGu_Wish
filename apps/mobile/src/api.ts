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

import { Platform } from "react-native";

import type {
  FeedPost,
  FeedPostListResponse,
  GroupBuy,
  Influencer,
  InstagramMediaInfo,
  Submission,
} from "./types";
export {
  searchInfluencers,
  normalizeForSearch,
  pushRecentTerm,
} from "./utils/search";

import {
  postgrestGet,
  postgrestPost,
  postgrestFetch,
  callEdgeFunction,
} from "./lib/postgrest-client";
import { ApiError, type ApiValidationError } from "./lib/api-types";
import { normalizePriceKrw } from "./utils/price";

// ─── Re-export ApiError for consumers that import it ─────────────────────────
export type { ApiValidationError } from "./lib/api-types";
export { ApiError } from "./lib/api-types";

// ─── Ranking types (mobile-specific) ─────────────────────────────────────────

export type RankingCategory =
  | "all"
  | "food"
  | "living"
  | "beauty"
  | "fashion"
  | "home"
  | "kitchen"
  | "electronics"
  | "pet"
  | "auto"
  | "hobby"
  | "baby"
  | "sports"
  | "stationery"
  | "books"
  | "media"
  | "travel";
export type RankingPeriod = "today" | "weekly" | "monthly";
export type RankingSort = "popular" | "rising" | "deadlineSoon" | "newDeal";
export type RankingTrend =
  | { kind: "up"; delta: number }
  | { kind: "down"; delta: number }
  | { kind: "same" }
  | { kind: "new" };
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
  category: Exclude<RankingCategory, "all">;
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
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
};

// ─── NestJS URL (kept for postPublicJson) ────────────────────────────────────

export const API_BASE_URL = Platform.select({
  android: "http://10.0.2.2:3003/api/v1",
  ios: "http://localhost:3003/api/v1",
  default: "http://192.168.219.122:3003/api/v1",
}) as string;

// ─── Sample Data ─────────────────────────────────────────────────────────────

export const fallbackGroupBuys: GroupBuy[] = [
  {
    id: "sample-1",
    productName: "비건 선크림 공구",
    brandName: "Sample Beauty",
    category: "beauty",
    endDate: "2026-06-15T23:59:59+09:00",
    purchaseUrl: "https://example.com",
    discountInfo: "20% 할인",
    summary: "인플루언서 게시물에서 감지된 공동구매 후보입니다.",
    confidence: 0.82,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://www.instagram.com/",
      influencer: {
        instagramUsername: "sample_influencer",
      },
    },
  },
  {
    id: "sample-2",
    productName: "프리미엄 유아용품 세트",
    brandName: "맘편한세상",
    category: "baby",
    endDate: "2026-07-01T23:59:59+09:00",
    purchaseUrl: "https://example.com/baby",
    discountInfo: "35% 할인",
    summary: "신생아부터 돌까지 필요한 유아용품을 한 번에.",
    confidence: 0.91,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://www.instagram.com/",
      influencer: {
        instagramUsername: "mom_blogger",
      },
    },
  },
  {
    id: "sample-3",
    productName: "올인원 홈트레이닝 키트",
    brandName: "핏스타그램",
    category: "living",
    endDate: "2026-06-28T23:59:59+09:00",
    purchaseUrl: "https://example.com/fitness",
    discountInfo: "25% 할인",
    summary: "홈트레이닝에 필요한 모든 도구를 세트로.",
    confidence: 0.78,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://www.instagram.com/",
      influencer: {
        instagramUsername: "fitness_influencer",
      },
    },
  },
  {
    id: "sample-4",
    productName: "스마트 홈 카메라",
    brandName: "테크스토어",
    category: "electronics",
    endDate: "2026-06-20T23:59:59+09:00",
    purchaseUrl: "https://example.com/camera",
    discountInfo: "15% 할인",
    summary: "반려동물, 아이 모니터링에 최적화된 스마트 카메라.",
    confidence: 0.85,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://www.instagram.com/",
      influencer: {
        instagramUsername: "tech_reviewer",
      },
    },
  },
  {
    id: "sample-5",
    productName: "자연유래 클렌징 3종 세트",
    brandName: "글로우스킨",
    category: "beauty",
    endDate: "2026-07-10T23:59:59+09:00",
    purchaseUrl: "https://example.com/skincare",
    discountInfo: "30% 할인",
    summary: "민감성 피부를 위한 저자극 클렌징 라인.",
    confidence: 0.88,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://www.instagram.com/",
      influencer: {
        instagramUsername: "skincare_expert",
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
    const { data } = await postgrestGet<any[]>(
      "group_buys?select=*,raw_post_id(*,influencer_id(*))&status=eq.APPROVED&order=created_at.desc",
    );
    return mapGroupBuyRows(data || []);
  } catch (error) {
    console.log(
      "[GroupBuys] fetch failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Map raw PostgREST group_buy rows into the app's GroupBuy type.
 */
export function mapGroupBuyRows(rows: any[]): GroupBuy[] {
  return (rows || []).map((item) => {
    const rawPriceKrw =
      item.priceKrw !== undefined ? item.priceKrw : item.price_krw;
    const priceKrw = normalizePriceKrw(rawPriceKrw);
    // Home banners are opt-in. A missing field must not be treated as enabled
    // while an older API/schema is being rolled out.
    const isHomeBanner =
      item.isHomeBanner !== undefined
        ? item.isHomeBanner === true
        : item.is_home_banner === true;
    const homeBannerStartDate =
      item.homeBannerStartDate !== undefined
        ? item.homeBannerStartDate
        : item.home_banner_start_date;
    const homeBannerEndDate =
      item.homeBannerEndDate !== undefined
        ? item.homeBannerEndDate
        : item.home_banner_end_date;

    return {
      id: item.id,
      productName: item.productName ?? item.product_name ?? null,
      brandName: item.brandName ?? item.brand_name ?? null,
      category: item.category ?? null,
      startDate: item.startDate ?? item.start_date ?? null,
      endDate: item.endDate ?? item.end_date ?? null,
      purchaseUrl: item.purchaseUrl ?? item.purchase_url ?? null,
      discountInfo: item.discountInfo ?? item.discount_info ?? null,
      ...(priceKrw !== undefined ? { priceKrw } : {}),
      summary: item.summary ?? null,
      confidence: item.confidence ?? 0,
      thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? null,
      videoUrl: item.videoUrl ?? item.video_url ?? null,
      mediaUrls: item.mediaUrls ?? item.media_urls ?? [],
      mediaItems: item.mediaItems ?? item.media_items ?? [],
      mediaType: item.mediaType ?? item.media_type ?? null,
      ...(item.isMonthlyFeatured !== undefined
        ? { isMonthlyFeatured: item.isMonthlyFeatured }
        : {}),
      ...(item.monthlyFeaturedRank !== undefined
        ? { monthlyFeaturedRank: item.monthlyFeaturedRank }
        : {}),
      isHomeBanner,
      ...(homeBannerStartDate !== undefined ? { homeBannerStartDate } : {}),
      ...(homeBannerEndDate !== undefined ? { homeBannerEndDate } : {}),
      createdAt: item.createdAt ?? item.created_at ?? undefined,
      rawPost: {
        postUrl:
          item.rawPostId?.postUrl ??
          item.raw_post_id?.postUrl ??
          item.raw_post_id?.post_url ??
          "",
        influencer: {
          instagramUsername:
            item.rawPostId?.influencerId?.instagramUsername ??
            item.raw_post_id?.influencer_id?.instagramUsername ??
            item.raw_post_id?.influencer_id?.instagram_username ??
            "",
        },
      },
    };
  }) as GroupBuy[];
}

/**
 * Convert an approved group buy into a feed post.
 * This lets the feed section show submissions after they are approved.
 */
function mapGroupBuyToFeedPost(item: GroupBuy): FeedPost {
  const now = new Date().toISOString();
  const thumbnailUrl =
    item.thumbnailUrl ??
    (item.mediaType === "IMAGE" ? (item.mediaUrls[0] ?? null) : null);
  const mediaUrl =
    item.mediaType === "VIDEO"
      ? (item.videoUrl ?? item.mediaUrls[0] ?? thumbnailUrl)
      : (item.mediaUrls[0] ?? thumbnailUrl);

  return {
    id: item.id,
    instagramUrl: item.rawPost.postUrl,
    thumbnailUrl,
    mediaUrl,
    mediaType: item.mediaType,
    caption: item.summary ?? null,
    accountName: item.rawPost.influencer.instagramUsername ?? null,
    linkUrl: item.purchaseUrl,
    openDate: item.startDate,
    closeDate: item.endDate,
    isActive: true,
    sortOrder: 0,
    ogTitle: item.productName,
    ogDescription: item.summary,
    ogImage: thumbnailUrl,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Fetch paginated feed posts.
 * GET /rest/v1/feed_posts + Range header + count=exact
 */
export async function fetchFeeds(
  page = 1,
  limit = 20,
): Promise<FeedPostListResponse> {
  try {
    const { data, meta } = await postgrestGet<any[]>(
      "group_buys?select=*,raw_post_id(*,influencer_id(*))&status=eq.APPROVED&order=created_at.desc",
      {
        pagination: { page, limit },
      },
    );
    const groupBuys = mapGroupBuyRows(data || []);
    return {
      items: groupBuys.map(mapGroupBuyToFeedPost),
      meta: meta ?? { total: 0, page, limit, totalPages: 0 },
    };
  } catch (error) {
    console.log(
      "[Feed] fetch failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Fetch a single feed post by ID.
 * GET /rest/v1/feed_posts?id=eq.{id}
 */
export async function fetchFeedPost(id: string): Promise<FeedPost> {
  const { data } = await postgrestGet<any[]>(
    `group_buys?select=*,raw_post_id(*,influencer_id(*))&id=eq.${encodeURIComponent(id)}&status=eq.APPROVED`,
  );
  const rows = data || [];
  const groupBuy = rows[0] ? mapGroupBuyRows([rows[0]])[0] : undefined;
  if (!groupBuy) {
    throw new ApiError(404, "Feed post not found");
  }
  return mapGroupBuyToFeedPost(groupBuy);
}

export async function fetchGroupBuyById(id: string): Promise<GroupBuy> {
  const { data } = await postgrestGet<any[]>(
    `group_buys?select=*,raw_post_id(*,influencer_id(*))&id=eq.${encodeURIComponent(id)}&status=eq.APPROVED`,
  );
  const rows = data || [];
  const groupBuy = rows[0] ? mapGroupBuyRows([rows[0]])[0] : undefined;
  if (!groupBuy) {
    throw new ApiError(404, "Group buy not found");
  }
  return groupBuy;
}

/**
 * Fetch all influencers.
 * GET /rest/v1/influencers
 */
export async function fetchInfluencers(): Promise<Influencer[]> {
  const { data } = await postgrestGet<Influencer[]>("influencers");
  return data;
}

// ─── Popular Search Terms (인기 검색어) ──────────────────────────────────────

export type PopularSearchTerm = {
  rank: number;
  keyword: string;
  count: number;
};

/**
 * Log a search submission so it counts toward the daily popular-search ranking.
 * Fire-and-forget: failures are swallowed so they never block the search UX.
 * POST /rest/v1/search_logs
 */
export async function logSearchTerm(
  keyword: string,
  groupBuyId?: string,
): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  try {
    // return=minimal avoids needing SELECT privileges on search_logs (anon only has INSERT).
    await postgrestFetch("search_logs", {
      method: "POST",
      body: {
        keyword: trimmed,
        ...(groupBuyId ? { group_buy_id: groupBuyId } : {}),
      },
      prefer: "return=minimal",
    });
  } catch (error) {
    console.log(
      "[SearchLogs] log failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Fetch the top-N popular search terms ranked by daily search volume.
 * RPC: get_popular_search_terms(limit_count, hours_window) — args passed in POST body.
 */
export async function fetchPopularSearchTerms(
  limit = 10,
  hours = 24,
): Promise<PopularSearchTerm[]> {
  try {
    const data = await postgrestPost<PopularSearchTerm[]>(
      "rpc/get_popular_search_terms",
      {
        limit_count: limit,
        hours_window: hours,
      },
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(
      "[SearchLogs] fetch popular failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

// ─── Popularity Signals (deep views + bookmarks) ────────────────────────────

export type PopularGroupBuy = {
  groupBuyId: string;
  deepViews: number;
  bookmarks: number;
  notifications: number;
  searchClicks: number;
  score: number;
};

/**
 * Log a "deep view" — only called after a reel was watched for >= 10s.
 * Fire-and-forget; failures never block the reels UX.
 * POST /rest/v1/group_buy_views
 */
export async function logDeepView(groupBuyId: string): Promise<void> {
  try {
    const { getSessionId } = await import("./utils/session");
    const sessionId = await getSessionId();
    await postgrestFetch("group_buy_views", {
      method: "POST",
      body: {
        group_buy_id: groupBuyId,
        view_type: "deep",
        session_id: sessionId,
      },
      prefer: "return=minimal",
    });
  } catch (error) {
    console.log(
      "[Popularity] log deep view failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Mirror a bookmark action to the server for popularity aggregation.
 * bookmark=true inserts, bookmark=false deletes by (group_buy_id, session_id).
 */
export async function syncBookmark(
  groupBuyId: string,
  bookmark: boolean,
): Promise<void> {
  try {
    const { getSessionId } = await import("./utils/session");
    const sessionId = await getSessionId();
    if (bookmark) {
      await postgrestFetch("group_buy_bookmarks", {
        method: "POST",
        body: { group_buy_id: groupBuyId, session_id: sessionId },
        prefer: "return=minimal",
      });
    } else {
      await postgrestFetch(
        `group_buy_bookmarks?group_buy_id=eq.${encodeURIComponent(groupBuyId)}&session_id=eq.${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );
    }
  } catch (error) {
    console.log(
      "[Popularity] sync bookmark failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Mirror a notification opt-in to the server for popularity aggregation.
 * enabled=true inserts, enabled=false deletes by (group_buy_id, session_id).
 */
export async function syncNotification(
  groupBuyId: string,
  enabled: boolean,
): Promise<void> {
  try {
    const { getSessionId } = await import("./utils/session");
    const sessionId = await getSessionId();
    if (enabled) {
      await postgrestFetch("group_buy_notifications", {
        method: "POST",
        body: { group_buy_id: groupBuyId, session_id: sessionId },
        prefer: "return=minimal",
      });
    } else {
      await postgrestFetch(
        `group_buy_notifications?group_buy_id=eq.${encodeURIComponent(groupBuyId)}&session_id=eq.${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );
    }
  } catch (error) {
    console.log(
      "[Popularity] sync notification failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Fetch group buys ranked by popularity (deep views + bookmarks).
 * RPC: get_popular_group_buys(limit, hours)
 */
export async function fetchPopularGroupBuys(
  limit = 20,
  hours = 168,
): Promise<PopularGroupBuy[]> {
  try {
    const data = await postgrestPost<PopularGroupBuy[]>(
      "rpc/get_popular_group_buys",
      {
        limit_count: limit,
        hours_window: hours,
      },
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(
      "[Popularity] fetch popular group buys failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Period-to-hours mapping for popular group buys.
 * today = 24h, weekly = 7d (168h), monthly = 30d (720h)
 */
export const POPULAR_PERIOD_HOURS: Record<
  "today" | "weekly" | "monthly",
  number
> = {
  today: 24,
  weekly: 168,
  monthly: 720,
};

/**
 * Fetch detailed group buys for a list of IDs (single PostgREST batch call).
 */
export async function fetchGroupBuysByIds(ids: string[]): Promise<GroupBuy[]> {
  if (ids.length === 0) return [];
  try {
    const { data } = await postgrestGet<any[]>(
      `group_buys?select=*,raw_post_id(*,influencer_id(*))&id=in.(${encodeURIComponent(ids.join(","))})&status=eq.APPROVED`,
    );
    return mapGroupBuyRows(data || []);
  } catch (error) {
    console.log(
      "[GroupBuys] fetch by ids failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Fetch popular group buys enriched with full GroupBuy detail.
 */
export async function fetchPopularGroupBuysWithDetail(
  limit = 20,
  hours = 168,
): Promise<Array<PopularGroupBuy & { groupBuy?: GroupBuy }>> {
  const popular = await fetchPopularGroupBuys(limit, hours);
  if (popular.length === 0) return [];
  const ids = popular.map((p) => p.groupBuyId);
  const details = await fetchGroupBuysByIds(ids);
  const detailMap = new Map(details.map((g) => [g.id, g]));
  return popular.map((p) => ({ ...p, groupBuy: detailMap.get(p.groupBuyId) }));
}

/**
 * Fetch group buys filtered by influencer username.
 * Uses PostgREST with embedded filter on raw_post -> influencer.
 */
export async function fetchGroupBuysByInfluencer(
  instagramUsername: string,
): Promise<GroupBuy[]> {
  const normalizedUsername = instagramUsername.replace(/^@/, "").toLowerCase();
  const { data } = await postgrestGet<any[]>(
    `group_buys?select=*,raw_post_id(*,influencer_id(*))&status=eq.APPROVED&raw_post_id.influencer_id.instagram_username=eq.${encodeURIComponent(normalizedUsername)}&order=created_at.desc`,
  );
  return mapGroupBuyRows(data || []);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTIONS — callEdgeFunction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch seller rankings.
 * POST /functions/v1/seller-rankings
 */
export async function fetchSellerRankings(
  query: SellerRankingQuery,
): Promise<SellerRanking[]> {
  const body = await callEdgeFunction<{ data: SellerRanking[] }>(
    "seller-rankings",
    query,
  );
  return body.data;
}

/**
 * Look up Instagram post metadata via HikerAPI Edge Function.
 * POST /functions/v1/hiker-lookup
 */
export async function lookupInstagramUrl(
  url: string,
): Promise<InstagramMediaInfo> {
  return callEdgeFunction<InstagramMediaInfo>("hiker-lookup", { url });
}

export type RefreshedInstagramMedia = {
  groupBuyId: string;
  refreshed: boolean;
  source: "cache" | "hiker" | "skipped";
  instagramUrl: string | null;
  media: Pick<
    InstagramMediaInfo,
    | "imageUrl"
    | "thumbnailUrl"
    | "videoUrl"
    | "mediaUrls"
    | "mediaItems"
    | "mediaType"
  >;
  error?: string;
};

/**
 * Refresh an expiring Instagram CDN media URL through a server-side cache.
 * The Edge Function decides whether HikerAPI is needed and persists fresh URLs.
 */
export async function refreshGroupBuyMedia(
  groupBuyId: string,
): Promise<RefreshedInstagramMedia> {
  return callEdgeFunction<RefreshedInstagramMedia>("refresh-instagram-media", {
    groupBuyId,
  });
}

/** Permanently delete the authenticated user's account and server-side profile. */
export async function deleteAccount(): Promise<void> {
  const result = await callEdgeFunction<{ deleted?: boolean }>(
    "delete-account",
    {},
  );
  if (!result.deleted) {
    throw new ApiError(502, "회원탈퇴 처리 결과를 확인할 수 없습니다.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Edge Function (service_role)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch admin JSON data via admin-api Edge Function.
 * POST /functions/v1/admin-api
 */
async function adminFetch<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  return callEdgeFunction<T>("admin-api", { path, method, body });
}

export async function fetchAdminJson<T>(path: string) {
  return adminFetch<T>(path);
}

export async function fetchAdminSubmissions() {
  const statuses: Submission["status"][] = [
    "REVIEW_REQUIRED",
    "APPROVED",
    "REJECTED",
  ];
  const groups: Submission[][] = [];
  for (const status of statuses) {
    const result = await adminFetch<Submission[]>(
      `/submissions?status=${status}&limit=50`,
    );
    groups.push(result);
  }
  return groups.flat();
}

export async function patchAdminJson<T>(path: string, payload: unknown) {
  return adminFetch<T>(path, "PATCH", payload);
}

export async function deleteAdminJson<T>(path: string) {
  return adminFetch<T>(path, "DELETE");
}

export async function postAdminJson<T>(path: string, payload?: unknown) {
  return adminFetch<T>(path, "POST", payload);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC WRITE — Edge Function for submissions, NestJS fallback for legacy paths
// ═══════════════════════════════════════════════════════════════════════════════

const PUBLIC_SUBMISSION_TIMEOUT_MS = 15_000;

async function postPublicSubmission<T>(body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    PUBLIC_SUBMISSION_TIMEOUT_MS,
  );

  try {
    return await callEdgeFunction<T>("public-submission", body, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        408,
        "요청 시간이 초과됐습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.",
      );
    }
    throw new ApiError(0, "네트워크 연결을 확인해주세요.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postPublicJson<T>(path: string, body: unknown) {
  if (path === "/submissions") {
    return postPublicSubmission<T>(body);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "네트워크 연결을 확인해주세요.");
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    if (response.status === 400) {
      try {
        const parsed = JSON.parse(errorText) as {
          message: string;
          errors?: ApiValidationError[];
        };
        if (parsed.errors) {
          throw new ApiError(
            400,
            parsed.message || "입력값을 확인해주세요.",
            parsed.errors,
          );
        }
      } catch {
        // fall through
      }
    }

    const displayMessage =
      response.status === 429
        ? "잠시 후 다시 시도해주세요."
        : errorText || `Public API failed: ${response.status}`;

    throw new ApiError(response.status, displayMessage);
  }

  return (await response.json()) as T;
}
