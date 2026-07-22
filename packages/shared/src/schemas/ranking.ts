import { z } from "zod";

export const rankingCategorySchema = z.enum([
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
]);

export type RankingCategory = z.infer<typeof rankingCategorySchema>;

export const rankingPeriodSchema = z.enum(["today", "weekly", "monthly"]);
export type RankingPeriod = z.infer<typeof rankingPeriodSchema>;

export const rankingSortSchema = z.enum(["popular", "rising", "deadlineSoon", "newDeal"]);
export type RankingSort = z.infer<typeof rankingSortSchema>;

export const groupBuyRankingQuerySchema = z
  .object({
    category: rankingCategorySchema.default("all"),
    period: rankingPeriodSchema.default("weekly"),
    sort: rankingSortSchema.default("popular"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type GroupBuyRankingQuery = z.infer<typeof groupBuyRankingQuerySchema>;

export const rankingTrendSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("up"), delta: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("down"), delta: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("same") }).strict(),
  z.object({ kind: z.literal("new") }).strict(),
]);

export type RankingTrend = z.infer<typeof rankingTrendSchema>;

export const groupBuyRankingMetricsSchema = z
  .object({
    deepViews: z.number().int().nonnegative(),
    bookmarks: z.number().int().nonnegative(),
    notifications: z.number().int().nonnegative(),
    searchClicks: z.number().int().nonnegative(),
    score: z.number().nonnegative(),
    scoreDelta: z.number(),
  })
  .strict();

export type GroupBuyRankingMetrics = z.infer<typeof groupBuyRankingMetricsSchema>;

export const groupBuyRankingItemSchema = z
  .object({
    groupBuyId: z.string().min(1),
    rank: z.number().int().positive(),
    previousRank: z.number().int().positive().nullable(),
    trend: rankingTrendSchema,
    productName: z.string().max(200).nullable(),
    brandName: z.string().max(100).nullable(),
    username: z.string().min(1).nullable(),
    category: rankingCategorySchema.exclude(["all"]),
    thumbnailUrl: z.string().min(1).nullable(),
    mediaUrls: z.array(z.string().min(1)),
    startDate: z.string().min(1).nullable(),
    endDate: z.string().min(1).nullable(),
    priceKrw: z.number().int().nonnegative().nullable(),
    metrics: groupBuyRankingMetricsSchema,
    scoreVersion: z.string().min(1),
  })
  .strict();

export type GroupBuyRankingItem = z.infer<typeof groupBuyRankingItemSchema>;

export const groupBuyRankingResponseSchema = z
  .object({
    data: z.array(groupBuyRankingItemSchema),
    pageInfo: z
      .object({
        limit: z.number().int().positive(),
        hasMore: z.boolean(),
        nextCursor: z.string().min(1).nullable(),
      })
      .strict(),
    meta: z
      .object({
        category: rankingCategorySchema,
        period: rankingPeriodSchema,
        sort: rankingSortSchema,
        scoreVersion: z.string().min(1),
        generatedAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict();

export type GroupBuyRankingResponse = z.infer<typeof groupBuyRankingResponseSchema>;
