import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (value: Record<string, unknown>) => value.ios ?? value.default,
  },
}));

import {
  fetchGroupBuyRankings,
  fetchGroupBuys,
  fetchHomeBannerGroupBuys,
  fetchPopularSearchTerms,
  logSearchTerm,
} from "../api";
import { resolveAudiencePolicy } from "../audience/audiencePolicy";
import { setAudiencePolicySnapshot } from "../audience/behaviorSignalsPolicy";
import { configurePostgrest } from "../lib/postgrest-client";
import {
  cleanupLocalFixture,
  createLocalFixture,
  getLocalSupabaseConfig,
  hasLocalSupabaseConfig,
  invokeAdmin,
  phaseLog,
  readGroupBuyRow,
  type LocalSupabaseConfig,
  type LocalSupabaseFixture,
} from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

async function invokeReminderRpc<T>(
  config: LocalSupabaseConfig,
  accessToken: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${config.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `[local-supabase:reminder-rpc] ${functionName} returned ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload as T;
}

describeLocal("local Supabase commerce and ranking contracts", () => {
  let config: LocalSupabaseConfig;
  let fixture: LocalSupabaseFixture | null = null;

  beforeAll(async () => {
    config = getLocalSupabaseConfig();
    configurePostgrest(config.anonKey, config.url);
    fixture = await createLocalFixture(config);
  });

  afterAll(async () => {
    await cleanupLocalFixture(config, fixture);
  });

  it("preserves admin price and hides a disabled home banner through the mobile fetch", async () => {
    if (!fixture)
      throw new Error("[local-supabase:setup] Fixture is unavailable");
    const groupBuyId = fixture.groupBuyIds[0];

    phaseLog("admin-save", "saving priceKrw=200000 and isHomeBanner=false");
    const updated = await invokeAdmin<{
      id: string;
      priceKrw: number;
      isHomeBanner: boolean;
      homeBannerStartDate: string | null;
      homeBannerEndDate: string | null;
    }>(config, fixture, "admin-save", {
      path: `/admin/group-buys/${groupBuyId}`,
      method: "PATCH",
      body: { priceKrw: 200000, isHomeBanner: false },
    });
    expect(updated).toMatchObject({
      id: groupBuyId,
      priceKrw: 200000,
      isHomeBanner: false,
      homeBannerStartDate: null,
      homeBannerEndDate: null,
    });

    const dbRow = await readGroupBuyRow<{
      id: string;
      price_krw: number;
      is_home_banner: boolean;
      home_banner_start_date: string | null;
      home_banner_end_date: string | null;
    }>(config, groupBuyId);
    expect(dbRow).toEqual({
      id: groupBuyId,
      price_krw: 200000,
      is_home_banner: false,
      home_banner_start_date: null,
      home_banner_end_date: null,
    });

    phaseLog("admin-list", "reading the saved row through admin-api list");
    const adminList = await invokeAdmin<{
      items: Array<{ id: string; priceKrw: number; isHomeBanner: boolean }>;
      total: number;
    }>(config, fixture, "admin-list", {
      path: "/admin/group-buys",
      method: "GET",
      params: { q: fixture.productName, page: 1, limit: 10 },
    });
    expect(
      adminList.items.find((item) => item.id === groupBuyId),
    ).toMatchObject({
      id: groupBuyId,
      priceKrw: 200000,
      isHomeBanner: false,
    });

    phaseLog(
      "public-fetch",
      "reading the same row through the mobile PostgREST mapper",
    );
    const publicItems = await fetchGroupBuys();
    expect(publicItems.find((item) => item.id === groupBuyId)).toMatchObject({
      id: groupBuyId,
      productName: fixture.productName,
      priceKrw: 200000,
      isHomeBanner: false,
    });
    const homeBanners = await fetchHomeBannerGroupBuys();
    expect(homeBanners.some((item) => item.id === groupBuyId)).toBe(false);
  });

  it("stores typed opening reminders while legacy RPCs remain deadline-only", async () => {
    if (!fixture)
      throw new Error("[local-supabase:setup] Fixture is unavailable");
    const groupBuyId = fixture.groupBuyIds[3];
    const startDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const originalDates = await readGroupBuyRow<{
      start_date: string;
      end_date: string | null;
    }>(config, groupBuyId);

    try {
      await invokeAdmin(config, fixture, "reminder-dates", {
        path: `/admin/group-buys/${groupBuyId}`,
        method: "PATCH",
        body: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      const openingRows = await invokeReminderRpc<
        Array<{
          group_buy_id: string;
          reminder_type: string;
          reminder_days: number[];
          reminder_time_minutes: number | null;
        }>
      >(config, fixture.adminAccessToken, "set_my_group_buy_reminder_v2", {
        p_group_buy_id: groupBuyId,
        p_reminder_type: "OPENING",
        p_reminder_days: [7, 0, 3, 3],
        p_reminder_time_minutes: 15 * 60 + 30,
      });
      expect(openingRows).toEqual([
        expect.objectContaining({
          group_buy_id: groupBuyId,
          reminder_type: "OPENING",
          reminder_days: [0, 3, 7],
          reminder_time_minutes: 15 * 60 + 30,
        }),
      ]);

      await expect(
        invokeReminderRpc(
          config,
          fixture.adminAccessToken,
          "get_my_group_buy_reminders",
          {},
        ),
      ).resolves.toEqual([]);

      await invokeReminderRpc(
        config,
        fixture.adminAccessToken,
        "set_my_group_buy_reminder",
        {
          p_group_buy_id: groupBuyId,
          p_reminder_days: [1],
        },
      );
      const v2Rows = await invokeReminderRpc<
        Array<{
          group_buy_id: string;
          reminder_type: string;
          reminder_days: number[];
          reminder_time_minutes: number | null;
        }>
      >(config, fixture.adminAccessToken, "get_my_group_buy_reminders_v2", {});
      expect(v2Rows).toContainEqual(
        expect.objectContaining({
          group_buy_id: groupBuyId,
          reminder_type: "DEADLINE",
          reminder_days: [1],
          reminder_time_minutes: null,
        }),
      );
    } finally {
      await invokeReminderRpc(
        config,
        fixture.adminAccessToken,
        "set_my_group_buy_reminder",
        {
          p_group_buy_id: groupBuyId,
          p_reminder_days: [],
        },
      );
      await invokeAdmin(config, fixture, "reminder-dates-restore", {
        path: `/admin/group-buys/${groupBuyId}`,
        method: "PATCH",
        body: {
          startDate: originalDates.start_date,
          endDate: originalDates.end_date,
        },
      });
    }
  });

  it("ranks selected product names but excludes unselected search queries", async () => {
    if (!fixture)
      throw new Error("[local-supabase:setup] Fixture is unavailable");
    const recentOnlyQuery = "임의검색-최근전용";
    const selectedProductName = "선택제품-인기집계";
    const selectedProductId = "search-popularity-contract-product";

    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
    try {
      await logSearchTerm(recentOnlyQuery);
      await logSearchTerm(selectedProductName, selectedProductId);

      const popularTerms = await fetchPopularSearchTerms(50, 24);
      expect(popularTerms.some((term) => term.keyword === recentOnlyQuery)).toBe(
        false,
      );
      expect(
        popularTerms.some((term) => term.keyword === selectedProductName),
      ).toBe(true);
    } finally {
      setAudiencePolicySnapshot(resolveAudiencePolicy(null));
    }
  });

  it("keeps category, period, sort, and cursor consistent through the mobile ranking client", async () => {
    if (!fixture)
      throw new Error("[local-supabase:setup] Fixture is unavailable");
    phaseLog("ranking", "checking filter metadata and real period aggregation");

    const today = await fetchGroupBuyRankings({
      category: "food",
      period: "today",
      sort: "popular",
      limit: 10,
    });
    const weekly = await fetchGroupBuyRankings({
      category: "food",
      period: "weekly",
      sort: "popular",
      limit: 10,
    });
    expect(today.meta).toMatchObject({
      category: "food",
      period: "today",
      sort: "popular",
    });
    expect(weekly.meta).toMatchObject({
      category: "food",
      period: "weekly",
      sort: "popular",
    });
    expect(today.data.every((item) => item.category === "food")).toBe(true);
    expect(weekly.data.every((item) => item.category === "food")).toBe(true);
    const todayFixture = today.data.find(
      (item) => item.groupBuyId === fixture?.groupBuyIds[0],
    );
    const weeklyFixture = weekly.data.find(
      (item) => item.groupBuyId === fixture?.groupBuyIds[0],
    );
    expect(todayFixture?.metrics.deepViews).toBe(6);
    expect(weeklyFixture?.metrics.deepViews).toBe(9);
    expect(weeklyFixture?.priceKrw).toBe(200000);

    for (const sort of ["rising", "deadlineSoon", "newDeal"] as const) {
      const response = await fetchGroupBuyRankings({
        category: "food",
        period: "monthly",
        sort,
        limit: 10,
      });
      expect(response.meta).toMatchObject({
        category: "food",
        period: "monthly",
        sort,
      });
      expect(response.data.every((item) => item.category === "food")).toBe(
        true,
      );
    }

    phaseLog("ranking", "checking opaque cursor pagination without duplicates");
    const firstPage = await fetchGroupBuyRankings({
      category: "food",
      period: "weekly",
      sort: "popular",
      limit: 2,
    });
    expect(firstPage.pageInfo).toMatchObject({ limit: 2, hasMore: true });
    expect(firstPage.pageInfo.nextCursor).toEqual(expect.any(String));
    const secondPage = await fetchGroupBuyRankings({
      category: "food",
      period: "weekly",
      sort: "popular",
      limit: 2,
      cursor: firstPage.pageInfo.nextCursor ?? undefined,
    });
    const firstIds = new Set(firstPage.data.map((item) => item.groupBuyId));
    expect(secondPage.data.some((item) => firstIds.has(item.groupBuyId))).toBe(
      false,
    );
    expect(secondPage.meta).toMatchObject({
      category: "food",
      period: "weekly",
      sort: "popular",
    });

    await expect(
      fetchGroupBuyRankings({
        category: "beauty",
        period: "weekly",
        sort: "popular",
        limit: 2,
        cursor: firstPage.pageInfo.nextCursor ?? undefined,
      }),
    ).rejects.toThrow("cursor category");
    await expect(
      fetchGroupBuyRankings({
        category: "food",
        period: "monthly",
        sort: "popular",
        limit: 2,
        cursor: firstPage.pageInfo.nextCursor ?? undefined,
      }),
    ).rejects.toThrow("cursor period");
    await expect(
      fetchGroupBuyRankings({
        category: "food",
        period: "weekly",
        sort: "deadlineSoon",
        limit: 2,
        cursor: firstPage.pageInfo.nextCursor ?? undefined,
      }),
    ).rejects.toThrow("cursor sort");

    for (const sort of [
      "popular",
      "rising",
      "deadlineSoon",
      "newDeal",
    ] as const) {
      phaseLog("ranking", `walking every ${sort} keyset page`);
      const full = await fetchGroupBuyRankings({
        category: "food",
        period: "monthly",
        sort,
        limit: 100,
      });
      if (sort === "deadlineSoon") {
        const nullDeadlineFixtureIds = new Set(fixture.groupBuyIds.slice(0, 3));
        const nullDeadlineFixtures = full.data.filter(
          (item) =>
            nullDeadlineFixtureIds.has(item.groupBuyId) &&
            item.endDate === null,
        );
        expect(nullDeadlineFixtures).toHaveLength(3);
        const scoreById = new Map(
          nullDeadlineFixtures.map((item) => [
            item.groupBuyId,
            item.metrics.score,
          ]),
        );
        const tiedScore = scoreById.get(fixture.groupBuyIds[0]);
        expect(tiedScore).toEqual(expect.any(Number));
        expect(scoreById.get(fixture.groupBuyIds[1])).toBe(tiedScore);
        expect(scoreById.get(fixture.groupBuyIds[2])).toBeLessThan(
          tiedScore as number,
        );
        expect(
          full.data.find((item) => item.groupBuyId === fixture?.groupBuyIds[3])
            ?.endDate,
        ).toEqual(expect.any(String));
      }
      const pagedIds: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 100; page += 1) {
        const response = await fetchGroupBuyRankings({
          category: "food",
          period: "monthly",
          sort,
          limit: 1,
          cursor,
        });
        pagedIds.push(...response.data.map((item) => item.groupBuyId));
        if (!response.pageInfo.hasMore) break;
        cursor = response.pageInfo.nextCursor ?? undefined;
        expect(cursor).toEqual(expect.any(String));
      }
      expect(pagedIds).toEqual(full.data.map((item) => item.groupBuyId));
      expect(new Set(pagedIds).size).toBe(pagedIds.length);
    }
  });
});
