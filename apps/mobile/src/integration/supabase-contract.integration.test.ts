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
} from "../api";
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
        const nullDeadlineFixtures = full.data.filter(
          (item) =>
            (item.groupBuyId === fixture?.groupBuyIds[0] ||
              item.groupBuyId === fixture?.groupBuyIds[1]) &&
            item.endDate === null,
        );
        expect(nullDeadlineFixtures).toHaveLength(2);
        expect(
          new Set(nullDeadlineFixtures.map((item) => item.metrics.score)).size,
        ).toBe(1);
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
