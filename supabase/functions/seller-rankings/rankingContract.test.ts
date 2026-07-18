import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  assertRankingCursorMatchesRequest,
  buildRankingResponse,
  decodeRankingCursor,
  encodeRankingCursor,
  normalizeRankingRequest,
} from "./rankingContract.ts";

Deno.test(
  "normalizes the group-buy ranking request without hidden defaults",
  () => {
    assertEquals(
      normalizeRankingRequest({ category: "food", period: "today" }),
      {
        category: "food",
        period: "today",
        sort: "popular",
        limit: 20,
        cursor: undefined,
      },
    );
  },
);

Deno.test("rejects unknown ranking filters and unsafe page sizes", async () => {
  await assertRejects(
    async () => {
      normalizeRankingRequest({ sort: "random" });
    },
    Error,
    "sort",
  );
  await assertRejects(
    async () => {
      normalizeRankingRequest({ limit: 0 });
    },
    Error,
    "limit",
  );
  await assertRejects(
    async () => {
      normalizeRankingRequest({ cursor: 42 });
    },
    Error,
    "cursor",
  );
});

Deno.test(
  "round-trips an opaque cursor without losing its typed sort key",
  () => {
    const cursor = {
      category: "food" as const,
      period: "weekly" as const,
      sort: "popular" as const,
      groupBuyId: "group-buy-2",
      numericValue: 42,
      secondaryScore: 42,
    };

    assertEquals(decodeRankingCursor(encodeRankingCursor(cursor)), cursor);
  },
);

Deno.test(
  "rejects a cursor without the sort key required by the requested order",
  async () => {
    await assertRejects(
      async () => {
        decodeRankingCursor(
          encodeRankingCursor({
            category: "food",
            period: "weekly",
            sort: "popular",
            groupBuyId: "group-buy-2",
            secondaryScore: 42,
          }),
        );
      },
      Error,
      "numeric sort key",
    );
  },
);

Deno.test("rejects a cursor without its secondary score", async () => {
  await assertRejects(
    async () => {
      decodeRankingCursor(
        encodeRankingCursor({
          category: "food",
          period: "weekly",
          sort: "popular",
          groupBuyId: "group-buy-2",
          numericValue: 42,
          secondaryScore: Number.NaN,
        }),
      );
    },
    Error,
    "secondary score",
  );
});

Deno.test("rejects a cursor reused with another ranking filter", async () => {
  const cursor = decodeRankingCursor(
    encodeRankingCursor({
      category: "food",
      period: "weekly",
      sort: "rising",
      groupBuyId: "group-buy-2",
      numericValue: 12,
      secondaryScore: 42,
    }),
  );

  await assertRejects(
    async () => {
      assertRankingCursorMatchesRequest(
        cursor,
        normalizeRankingRequest({
          category: "beauty",
          period: "weekly",
          sort: "rising",
        }),
      );
    },
    Error,
    "category",
  );
  await assertRejects(
    async () => {
      assertRankingCursorMatchesRequest(
        cursor,
        normalizeRankingRequest({
          category: "food",
          period: "monthly",
          sort: "rising",
        }),
      );
    },
    Error,
    "period",
  );
  await assertRejects(
    async () => {
      assertRankingCursorMatchesRequest(
        cursor,
        normalizeRankingRequest({
          category: "food",
          period: "weekly",
          sort: "popular",
        }),
      );
    },
    Error,
    "sort",
  );
});

Deno.test(
  "builds a response with a next cursor only when another page exists",
  () => {
    const response = buildRankingResponse(
      [
        {
          group_buy_id: "group-buy-1",
          rank: 1,
          previous_rank: null,
          trend_kind: "new",
          trend_delta: 0,
          product_name: "첫 공구",
          brand_name: null,
          username: "seller-1",
          category: "food",
          thumbnail_url: null,
          media_urls: [],
          start_date: null,
          end_date: null,
          price_krw: null,
          created_at: "2026-07-16T00:00:00.000Z",
          deep_views: 1,
          bookmarks: 2,
          notifications: 3,
          search_clicks: 4,
          score: 14,
          score_delta: 14,
          score_version: "v2",
        },
        {
          group_buy_id: "group-buy-2",
          rank: 2,
          previous_rank: null,
          trend_kind: "same",
          trend_delta: 0,
          product_name: "둘째 공구",
          brand_name: null,
          username: "seller-2",
          category: "food",
          thumbnail_url: null,
          media_urls: [],
          start_date: null,
          end_date: null,
          price_krw: null,
          created_at: "2026-07-15T00:00:00.000Z",
          deep_views: 0,
          bookmarks: 0,
          notifications: 0,
          search_clicks: 0,
          score: 0,
          score_delta: 0,
          score_version: "v2",
        },
      ],
      normalizeRankingRequest({ sort: "popular", limit: 1 }),
      "2026-07-16T00:00:00.000Z",
    );

    assertEquals(response.data.length, 1);
    assertEquals(response.data[0].groupBuyId, "group-buy-1");
    assertEquals(response.pageInfo.hasMore, true);
    assertEquals(response.pageInfo.nextCursor !== null, true);
    assertEquals(decodeRankingCursor(response.pageInfo.nextCursor!), {
      category: "all",
      period: "weekly",
      sort: "popular",
      groupBuyId: "group-buy-1",
      numericValue: 14,
      secondaryScore: 14,
    });
    assertEquals(response.meta.scoreVersion, "v2");
  },
);

Deno.test(
  "derives the trend delta from rank movement instead of score delta",
  () => {
    const response = buildRankingResponse(
      [
        {
          group_buy_id: "group-buy-rank-movement",
          rank: 1,
          previous_rank: 17,
          trend_kind: "up",
          trend_delta: 6,
          product_name: "순위 이동 공구",
          brand_name: null,
          username: "seller-rank-movement",
          category: "food",
          thumbnail_url: null,
          media_urls: [],
          start_date: null,
          end_date: null,
          price_krw: null,
          created_at: "2026-07-16T00:00:00.000Z",
          deep_views: 1,
          bookmarks: 0,
          notifications: 0,
          search_clicks: 0,
          score: 35,
          score_delta: 6,
          score_version: "v2",
        },
      ],
      normalizeRankingRequest({ sort: "popular" }),
    );

    assertEquals(response.data[0].previousRank, 17);
    assertEquals(response.data[0].trend, { kind: "up", delta: 16 });
  },
);

Deno.test("marks an item NEW when its previous score was zero", () => {
  const response = buildRankingResponse(
    [
      {
        group_buy_id: "group-buy-new",
        rank: 1,
        previous_rank: 1,
        trend_kind: "new",
        trend_delta: 54,
        product_name: "신규 신호 공구",
        brand_name: null,
        username: "seller-new",
        category: "food",
        thumbnail_url: null,
        media_urls: [],
        start_date: null,
        end_date: null,
        price_krw: null,
        created_at: "2026-07-16T00:00:00.000Z",
        deep_views: 15,
        bookmarks: 1,
        notifications: 2,
        search_clicks: 3,
        score: 54,
        score_delta: 54,
        score_version: "v2",
      },
    ],
    normalizeRankingRequest({ sort: "popular" }),
  );

  assertEquals(response.data[0].previousRank, null);
  assertEquals(response.data[0].trend, { kind: "new" });
});

Deno.test(
  "keeps the trend steady when rank is unchanged despite a score decrease",
  () => {
    const response = buildRankingResponse(
      [
        {
          group_buy_id: "group-buy-steady-rank",
          rank: 1,
          previous_rank: 1,
          trend_kind: "down",
          trend_delta: 6,
          product_name: "순위 유지 공구",
          brand_name: null,
          username: "seller-steady-rank",
          category: "food",
          thumbnail_url: null,
          media_urls: [],
          start_date: null,
          end_date: null,
          price_krw: null,
          created_at: "2026-07-16T00:00:00.000Z",
          deep_views: 0,
          bookmarks: 0,
          notifications: 0,
          search_clicks: 0,
          score: 0,
          score_delta: -6,
          score_version: "v2",
        },
      ],
      normalizeRankingRequest({ sort: "popular" }),
    );

    assertEquals(response.data[0].previousRank, 1);
    assertEquals(response.data[0].trend, { kind: "same" });
  },
);
