import { describe, expect, it } from "vitest";

import {
  groupBuyRankingItemSchema,
  groupBuyRankingQuerySchema,
  groupBuyRankingResponseSchema,
} from "./ranking";

const rankingItem = {
  groupBuyId: "group-buy-1",
  rank: 1,
  previousRank: null,
  trend: { kind: "new" as const },
  productName: "테스트 공구",
  brandName: "테스트 브랜드",
  username: "gonggu_test",
  category: "food" as const,
  thumbnailUrl: "https://example.com/thumb.jpg",
  mediaUrls: ["https://example.com/thumb.jpg"],
  startDate: null,
  endDate: null,
  priceKrw: 25900,
  metrics: {
    deepViews: 12,
    bookmarks: 4,
    notifications: 3,
    searchClicks: 2,
    score: 48,
    scoreDelta: 8,
  },
  scoreVersion: "v2",
};

describe("group buy ranking contract", () => {
  it("applies safe query defaults and preserves an opaque cursor", () => {
    expect(
      groupBuyRankingQuerySchema.parse({
        category: "all",
        period: "weekly",
        sort: "popular",
        cursor: "eyJrZXkiOiIxMjMifQ",
      }),
    ).toEqual({
      category: "all",
      period: "weekly",
      sort: "popular",
      limit: 20,
      cursor: "eyJrZXkiOiIxMjMifQ",
    });
  });

  it("requires a groupBuyId and explicit metrics", () => {
    expect(groupBuyRankingItemSchema.parse(rankingItem)).toEqual(rankingItem);

    expect(() =>
      groupBuyRankingItemSchema.parse({
        ...rankingItem,
        groupBuyId: undefined,
      }),
    ).toThrow();
  });

  it("allows a ranking item to omit an unavailable Instagram account", () => {
    expect(
      groupBuyRankingItemSchema.parse({
        ...rankingItem,
        username: null,
      }).username,
    ).toBeNull();
  });

  it("rejects the legacy representativeGroupBuyId contract", () => {
    expect(() =>
      groupBuyRankingItemSchema.parse({
        ...rankingItem,
        representativeGroupBuyId: "group-buy-1",
      }),
    ).toThrow();
  });

  it("models pagination and score metadata separately from the item list", () => {
    const response = groupBuyRankingResponseSchema.parse({
      data: [rankingItem],
      pageInfo: {
        limit: 20,
        hasMore: true,
        nextCursor: "eyJrZXkiOiIxMjMifQ",
      },
      meta: {
        category: "all",
        period: "weekly",
        sort: "popular",
        scoreVersion: "v2",
        generatedAt: "2026-07-16T00:00:00.000Z",
      },
    });

    expect(response.pageInfo.hasMore).toBe(true);
    expect(response.meta.scoreVersion).toBe("v2");
  });
});
