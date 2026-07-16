export const SCORE_VERSION = "v2";

export const RANKING_CATEGORIES = [
  "all",
  "food",
  "living",
  "beauty",
  "fashion",
  "home",
  "kitchen",
  "electronics",
  "pet",
  "auto",
  "hobby",
  "baby",
  "sports",
  "stationery",
  "books",
  "media",
  "travel",
] as const;

export type RankingCategory = (typeof RANKING_CATEGORIES)[number];
export type RankingPeriod = "today" | "weekly" | "monthly";
export type RankingSort = "popular" | "rising" | "deadlineSoon" | "newDeal";

export type RankingRequest = {
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
  limit: number;
  cursor?: string;
};

export type RankingCursor = {
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
  groupBuyId: string;
  secondaryScore: number;
  numericValue?: number;
  timestampValue?: string | null;
};

export type RankingRpcRow = {
  group_buy_id: string;
  rank: number | string;
  previous_rank: number | string | null;
  trend_kind: "up" | "down" | "same" | "new";
  trend_delta: number | string;
  product_name: string | null;
  brand_name: string | null;
  username: string;
  category: string;
  thumbnail_url: string | null;
  media_urls: string[] | null;
  start_date: string | null;
  end_date: string | null;
  price_krw: number | null;
  created_at: string;
  deep_views: number | string;
  bookmarks: number | string;
  notifications: number | string;
  search_clicks: number | string;
  score: number | string;
  score_delta: number | string;
  score_version: string;
};

export type GroupBuyRankingItem = {
  groupBuyId: string;
  rank: number;
  previousRank: number | null;
  trend: { kind: "up" | "down"; delta: number } | { kind: "same" | "new" };
  productName: string | null;
  brandName: string | null;
  username: string;
  category: Exclude<RankingCategory, "all">;
  thumbnailUrl: string | null;
  mediaUrls: string[];
  startDate: string | null;
  endDate: string | null;
  priceKrw: number | null;
  metrics: {
    deepViews: number;
    bookmarks: number;
    notifications: number;
    searchClicks: number;
    score: number;
    scoreDelta: number;
  };
  scoreVersion: string;
};

export type GroupBuyRankingResponse = {
  data: GroupBuyRankingItem[];
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  meta: {
    category: RankingCategory;
    period: RankingPeriod;
    sort: RankingSort;
    scoreVersion: string;
    generatedAt: string;
  };
};

const LEGACY_CATEGORY_MAP: Record<string, Exclude<RankingCategory, "all">> = {
  lifestyle: "living",
  digital: "electronics",
};

const isRankingCategory = (value: unknown): value is RankingCategory =>
  typeof value === "string" &&
  (RANKING_CATEGORIES as readonly string[]).includes(value);

const isRankingPeriod = (value: unknown): value is RankingPeriod =>
  value === "today" || value === "weekly" || value === "monthly";

const isRankingSort = (value: unknown): value is RankingSort =>
  value === "popular" ||
  value === "rising" ||
  value === "deadlineSoon" ||
  value === "newDeal";

export function normalizeRankingCategory(value: unknown): RankingCategory {
  if (value === undefined || value === null || value === "") return "all";
  const normalized = LEGACY_CATEGORY_MAP[String(value)] ?? String(value);
  if (!isRankingCategory(normalized)) {
    throw new Error(
      `category must be a supported ranking category: ${String(value)}`,
    );
  }
  return normalized;
}

export function normalizeRankingRequest(input: unknown): RankingRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ranking request must be an object");
  }

  const value = input as Record<string, unknown>;
  const category = normalizeRankingCategory(value.category);
  const period = value.period === undefined ? "weekly" : value.period;
  const sort = value.sort === undefined ? "popular" : value.sort;
  const limit = value.limit === undefined ? 20 : Number(value.limit);

  if (!isRankingPeriod(period)) {
    throw new Error(`period must be today, weekly, or monthly`);
  }
  if (!isRankingSort(sort)) {
    throw new Error(`sort must be popular, rising, deadlineSoon, or newDeal`);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }

  if (value.cursor !== undefined && typeof value.cursor !== "string") {
    throw new Error("cursor must be an opaque string");
  }
  const cursor = value.cursor as string | undefined;
  if (cursor === "") throw new Error("cursor must not be empty");

  return { category, period, sort, limit, cursor };
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

export function encodeRankingCursor(cursor: RankingCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeRankingCursor(value: string): RankingCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(value));
  } catch {
    throw new Error("cursor is not a valid ranking cursor");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("cursor is not a valid ranking cursor");
  }
  const cursor = parsed as Record<string, unknown>;
  if (
    !isRankingCategory(cursor.category) ||
    !isRankingPeriod(cursor.period) ||
    !isRankingSort(cursor.sort) ||
    typeof cursor.groupBuyId !== "string" ||
    !cursor.groupBuyId ||
    typeof cursor.secondaryScore !== "number" ||
    !Number.isFinite(cursor.secondaryScore)
  ) {
    throw new Error("cursor is missing its filter identity or secondary score");
  }
  if (
    (cursor.sort === "popular" || cursor.sort === "rising") &&
    (typeof cursor.numericValue !== "number" ||
      !Number.isFinite(cursor.numericValue))
  ) {
    throw new Error("cursor is missing its numeric sort key");
  }
  if (cursor.sort === "newDeal" && typeof cursor.timestampValue !== "string") {
    throw new Error("cursor is missing its timestamp sort key");
  }
  if (
    cursor.sort === "deadlineSoon" &&
    cursor.timestampValue !== null &&
    typeof cursor.timestampValue !== "string"
  ) {
    throw new Error("cursor has an invalid timestamp sort key");
  }
  return parsed as RankingCursor;
}

export function assertRankingCursorMatchesRequest(
  cursor: RankingCursor,
  request: RankingRequest,
): void {
  if (cursor.category !== request.category) {
    throw new Error("cursor category does not match the requested category");
  }
  if (cursor.period !== request.period) {
    throw new Error("cursor period does not match the requested period");
  }
  if (cursor.sort !== request.sort) {
    throw new Error("cursor sort does not match the requested ranking sort");
  }
}

function toNonNegativeInteger(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("ranking metric is invalid");
  }
  return parsed;
}

function toPositiveInteger(value: number | string): number {
  const parsed = toNonNegativeInteger(value);
  if (parsed < 1) throw new Error("ranking rank is invalid");
  return parsed;
}

function toNumber(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("ranking score is invalid");
  return parsed;
}

function toRankingItem(row: RankingRpcRow): GroupBuyRankingItem {
  const category = normalizeRankingCategory(row.category);
  if (category === "all") throw new Error("ranking row category cannot be all");

  const trendDelta = toNonNegativeInteger(row.trend_delta);
  const rank = toPositiveInteger(row.rank);
  const previousRank = row.previous_rank === null
    ? null
    : toPositiveInteger(row.previous_rank);
  const mediaUrls = row.media_urls ?? [];
  if (!row.group_buy_id || !row.username || !row.score_version) {
    throw new Error("ranking row identity is invalid");
  }
  if (!["up", "down", "same", "new"].includes(row.trend_kind)) {
    throw new Error("ranking trend is invalid");
  }
  if (mediaUrls.some((url) => typeof url !== "string" || url.length === 0)) {
    throw new Error("ranking media is invalid");
  }
  if (row.thumbnail_url !== null && row.thumbnail_url.length === 0) {
    throw new Error("ranking thumbnail is invalid");
  }
  const trend = row.trend_kind === "up" || row.trend_kind === "down"
    ? { kind: row.trend_kind, delta: trendDelta }
    : { kind: row.trend_kind };

  return {
    groupBuyId: row.group_buy_id,
    rank,
    previousRank,
    trend,
    productName: row.product_name,
    brandName: row.brand_name,
    username: row.username,
    category,
    thumbnailUrl: row.thumbnail_url,
    mediaUrls,
    startDate: row.start_date,
    endDate: row.end_date,
    priceKrw: row.price_krw,
    metrics: {
      deepViews: toNonNegativeInteger(row.deep_views),
      bookmarks: toNonNegativeInteger(row.bookmarks),
      notifications: toNonNegativeInteger(row.notifications),
      searchClicks: toNonNegativeInteger(row.search_clicks),
      score: toNumber(row.score),
      scoreDelta: toNumber(row.score_delta),
    },
    scoreVersion: row.score_version || SCORE_VERSION,
  };
}

function cursorForRow(
  row: RankingRpcRow,
  request: RankingRequest,
): RankingCursor {
  const cursor: RankingCursor = {
    category: request.category,
    period: request.period,
    sort: request.sort,
    groupBuyId: row.group_buy_id,
    secondaryScore: toNumber(row.score),
  };
  if (request.sort === "popular") cursor.numericValue = toNumber(row.score);
  if (request.sort === "rising") {
    cursor.numericValue = toNumber(row.score_delta);
  }
  if (request.sort === "deadlineSoon") cursor.timestampValue = row.end_date;
  if (request.sort === "newDeal") cursor.timestampValue = row.created_at;
  return cursor;
}

export function buildRankingResponse(
  rows: RankingRpcRow[],
  request: RankingRequest,
  generatedAt = new Date().toISOString(),
): GroupBuyRankingResponse {
  const pageRows = rows.slice(0, request.limit);
  const hasMore = rows.length > request.limit;
  const scoreVersion = pageRows[0]?.score_version || SCORE_VERSION;

  return {
    data: pageRows.map(toRankingItem),
    pageInfo: {
      limit: request.limit,
      hasMore,
      nextCursor: hasMore
        ? encodeRankingCursor(
          cursorForRow(pageRows[pageRows.length - 1], request),
        )
        : null,
    },
    meta: {
      category: request.category,
      period: request.period,
      sort: request.sort,
      scoreVersion,
      generatedAt,
    },
  };
}
