import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import type {
  GroupBuyRankingItem,
  GroupBuyRankingQuery,
  GroupBuyRankingResponse,
  RankingCategory,
  RankingSort,
} from "@gonggu/shared";

import { SupabaseService } from "../supabase/supabase.service";
import type { GroupBuyRankingQueryDto } from "./dto/seller-ranking-query.dto";

const SCORE_VERSION = "v2";
const RANKING_CATEGORIES: readonly RankingCategory[] = [
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
];
const RANKING_PERIODS = ["today", "weekly", "monthly"] as const;
const RANKING_SORTS: readonly RankingSort[] = [
  "popular",
  "rising",
  "deadlineSoon",
  "newDeal",
];

type RankingRpcRow = {
  group_buy_id: string;
  rank: number | string;
  previous_rank: number | string | null;
  trend_kind: "up" | "down" | "same" | "new";
  trend_delta: number | string;
  product_name: string | null;
  brand_name: string | null;
  username: string | null;
  category: string;
  thumbnail_url: string | null;
  media_urls: string[] | null;
  start_date: string | null;
  end_date: string | null;
  price_krw: number | string | null;
  created_at: string;
  deep_views: number | string;
  bookmarks: number | string;
  notifications: number | string;
  search_clicks: number | string;
  score: number | string;
  score_delta: number | string;
  score_version: string;
};

type RankingCursor = {
  sort: RankingSort;
  groupBuyId: string;
  numericValue?: number;
  timestampValue?: string | null;
};

function normalizeRankingUsername(value: string | null): string | null {
  const normalized =
    value
      ?.trim()
      .replace(/^@+\s*/, "")
      .trim() ?? "";
  return normalized && normalized.toLocaleLowerCase("en-US") !== "unknown"
    ? normalized
    : null;
}

function toFiniteNumber(value: number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} is invalid`);
  }
  return parsed;
}

function toNonNegativeInteger(value: number | string, field: string): number {
  const parsed = toFiniteNumber(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} is invalid`);
  }
  return parsed;
}

function toPositiveInteger(value: number | string, field: string): number {
  const parsed = toNonNegativeInteger(value, field);
  if (parsed < 1) {
    throw new Error(`${field} is invalid`);
  }
  return parsed;
}

function toNonNegativeNumber(value: number | string, field: string): number {
  const parsed = toFiniteNumber(value, field);
  if (parsed < 0) {
    throw new Error(`${field} is invalid`);
  }
  return parsed;
}

function deriveRankingTrend(
  rank: number,
  previousRank: number | null,
  score: number,
  scoreDelta: number,
): GroupBuyRankingItem["trend"] {
  const previousScore = score - scoreDelta;
  if (previousScore <= 0) {
    return score > 0 ? { kind: "new" } : { kind: "same" };
  }

  if (previousRank === null) return { kind: "new" };
  if (previousRank > rank) {
    return { kind: "up", delta: previousRank - rank };
  }
  if (previousRank < rank) {
    return { kind: "down", delta: rank - previousRank };
  }
  return { kind: "same" };
}

function encodeCursor(cursor: RankingCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string, sort: RankingSort): RankingCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestException("cursor가 올바르지 않습니다.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new BadRequestException("cursor가 올바르지 않습니다.");
  }

  const cursor = parsed as Record<string, unknown>;
  if (
    cursor.sort !== sort ||
    typeof cursor.groupBuyId !== "string" ||
    !cursor.groupBuyId
  ) {
    throw new BadRequestException("cursor가 현재 정렬과 일치하지 않습니다.");
  }

  if (
    cursor.numericValue !== undefined &&
    typeof cursor.numericValue !== "number"
  ) {
    throw new BadRequestException("cursor가 올바르지 않습니다.");
  }
  if (
    cursor.timestampValue !== undefined &&
    cursor.timestampValue !== null &&
    typeof cursor.timestampValue !== "string"
  ) {
    throw new BadRequestException("cursor가 올바르지 않습니다.");
  }
  if (
    (sort === "popular" || sort === "rising") &&
    (typeof cursor.numericValue !== "number" ||
      !Number.isFinite(cursor.numericValue))
  ) {
    throw new BadRequestException("cursor에 숫자 정렬 키가 없습니다.");
  }
  if (sort === "newDeal" && typeof cursor.timestampValue !== "string") {
    throw new BadRequestException("cursor에 시간 정렬 키가 없습니다.");
  }

  return cursor as RankingCursor;
}

function normalizeRequest(
  query: GroupBuyRankingQueryDto,
): GroupBuyRankingQuery {
  const category = (query.category ?? "all") as RankingCategory;
  const period = (query.period ?? "weekly") as GroupBuyRankingQuery["period"];
  const sort = (query.sort ?? "popular") as RankingSort;
  const limit = query.limit ?? 20;

  if (!RANKING_CATEGORIES.includes(category)) {
    throw new BadRequestException("지원하지 않는 랭킹 카테고리입니다.");
  }
  if (!RANKING_PERIODS.includes(period)) {
    throw new BadRequestException("지원하지 않는 랭킹 기간입니다.");
  }
  if (!RANKING_SORTS.includes(sort)) {
    throw new BadRequestException("지원하지 않는 랭킹 정렬입니다.");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException("랭킹 limit은 1에서 100 사이여야 합니다.");
  }
  if (query.cursor !== undefined && query.cursor.length === 0) {
    throw new BadRequestException("cursor는 비어 있을 수 없습니다.");
  }

  return {
    category,
    period,
    sort,
    limit,
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
  };
}

function toRankingItem(row: RankingRpcRow): GroupBuyRankingItem {
  const rank = toPositiveInteger(row.rank, "rank");
  const reportedPreviousRank =
    row.previous_rank === null
      ? null
      : toPositiveInteger(row.previous_rank, "previous_rank");
  const score = toNonNegativeNumber(row.score, "score");
  const scoreDelta = toFiniteNumber(row.score_delta, "score_delta");
  // The legacy RPC trend fields contain score movement; rank movement is derived here.
  const previousRank = score - scoreDelta > 0 ? reportedPreviousRank : null;
  const mediaUrls = row.media_urls ?? [];

  if (
    !row.group_buy_id ||
    !RANKING_CATEGORIES.includes(row.category as RankingCategory) ||
    row.category === "all"
  ) {
    throw new Error("ranking row identity is invalid");
  }
  if (!["up", "down", "same", "new"].includes(row.trend_kind)) {
    throw new Error("ranking trend is invalid");
  }
  if (
    !Array.isArray(mediaUrls) ||
    mediaUrls.some((url) => typeof url !== "string" || url.length === 0)
  ) {
    throw new Error("ranking media is invalid");
  }
  if (row.thumbnail_url !== null && row.thumbnail_url.length === 0) {
    throw new Error("ranking thumbnail is invalid");
  }

  const trend = deriveRankingTrend(rank, previousRank, score, scoreDelta);

  return {
    groupBuyId: row.group_buy_id,
    rank,
    previousRank,
    trend,
    productName: row.product_name,
    brandName: row.brand_name,
    username: normalizeRankingUsername(row.username),
    category: row.category as GroupBuyRankingItem["category"],
    thumbnailUrl: row.thumbnail_url,
    mediaUrls,
    startDate: row.start_date,
    endDate: row.end_date,
    priceKrw:
      row.price_krw === null
        ? null
        : toNonNegativeInteger(row.price_krw, "price_krw"),
    metrics: {
      deepViews: toNonNegativeInteger(row.deep_views, "deep_views"),
      bookmarks: toNonNegativeInteger(row.bookmarks, "bookmarks"),
      notifications: toNonNegativeInteger(row.notifications, "notifications"),
      searchClicks: toNonNegativeInteger(row.search_clicks, "search_clicks"),
      score,
      scoreDelta,
    },
    scoreVersion: row.score_version || SCORE_VERSION,
  };
}

@Injectable()
export class RankingService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(query: GroupBuyRankingQueryDto): Promise<GroupBuyRankingResponse> {
    const request = normalizeRequest(query);

    const cursor = request.cursor
      ? decodeCursor(request.cursor, request.sort)
      : undefined;
    const { data, error } = await this.supabase.admin.rpc(
      "get_group_buy_rankings",
      {
        category_filter: request.category,
        period_filter: request.period,
        sort_filter: request.sort,
        limit_count: request.limit + 1,
        cursor_numeric: cursor?.numericValue ?? null,
        cursor_timestamp: cursor?.timestampValue ?? null,
        cursor_group_buy_id: cursor?.groupBuyId ?? null,
      },
    );

    if (error) {
      throw new BadGatewayException("랭킹 집계 데이터를 불러오지 못했습니다.");
    }
    if (!Array.isArray(data)) {
      throw new BadGatewayException("랭킹 집계 응답이 올바르지 않습니다.");
    }

    try {
      const rows = data as RankingRpcRow[];
      const pageRows = rows.slice(0, request.limit);
      const mapped = pageRows.map(toRankingItem);
      const response: GroupBuyRankingResponse = {
        data: mapped,
        pageInfo: {
          limit: request.limit,
          hasMore: rows.length > request.limit,
          nextCursor:
            rows.length > request.limit
              ? encodeCursor({
                  sort: request.sort,
                  groupBuyId: mapped[mapped.length - 1].groupBuyId,
                  ...(request.sort === "popular" || request.sort === "rising"
                    ? {
                        numericValue:
                          request.sort === "popular"
                            ? mapped[mapped.length - 1].metrics.score
                            : mapped[mapped.length - 1].metrics.scoreDelta,
                      }
                    : {
                        timestampValue:
                          request.sort === "deadlineSoon"
                            ? mapped[mapped.length - 1].endDate
                            : String(rows[request.limit - 1].created_at),
                      }),
                })
              : null,
        },
        meta: {
          category: request.category,
          period: request.period,
          sort: request.sort,
          scoreVersion: mapped[0]?.scoreVersion ?? SCORE_VERSION,
          generatedAt: new Date().toISOString(),
        },
      };

      return response;
    } catch (caught) {
      if (caught instanceof BadRequestException) throw caught;
      throw new BadGatewayException("랭킹 응답 계약이 유효하지 않습니다.");
    }
  }
}
