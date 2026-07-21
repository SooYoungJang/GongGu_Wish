import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
});

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/supabase/client", () => ({
  adminRuntimeConfig: {
    adminApiOrigin: "https://example.supabase.co/functions/v1/admin-api",
    supabaseAnonKey: "test-anon-key",
  },
  supabase: {
    auth: { getSession },
  },
}));

import { adminApi } from "./adminApi";

describe("adminApi", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "admin-token" } },
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("forwards selected user IDs to the push notification endpoint", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          provider: "expo",
          targeted: 1,
          sent: 1,
          failed: 0,
          invalidTokensRemoved: 0,
        },
      }),
    } as Response);

    await adminApi.sendPushNotification({
      title: "개별 안내",
      body: "선택 사용자 본문",
      userIds: ["user-1"],
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      path: string;
      body: { title: string; body: string; userIds: string[] };
    };
    expect(request.path).toBe("/admin/notifications");
    expect(request.body).toEqual({
      title: "개별 안내",
      body: "선택 사용자 본문",
      userIds: ["user-1"],
    });
  });

  it("sends priceKrw and normalizes the persisted commerce response before the UI consumes it", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "group-buy-1",
          price_krw: "200000",
          is_home_banner: false,
          status: "APPROVED",
        },
      }),
    } as Response);

    const result = await adminApi.updateGroupBuy("group-buy-1", {
      priceKrw: 200000,
      isHomeBanner: false,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      body: { priceKrw: number; isHomeBanner: boolean };
    };
    expect(request.body.priceKrw).toBe(200000);
    expect(request.body.isHomeBanner).toBe(false);
    expect(result.priceKrw).toBe(200000);
    expect(result.isHomeBanner).toBe(false);
  });

  it("normalizes price and banner state returned by the refresh list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          items: [
            {
              id: "group-buy-1",
              price_krw: "200000",
              is_home_banner: false,
            },
          ],
          total: 1,
        },
      }),
    } as Response);

    const result = await adminApi.listGroupBuys({ page: 1, limit: 25 });

    expect(result.items[0].priceKrw).toBe(200000);
    expect(result.items[0].isHomeBanner).toBe(false);
  });

  it("rejects a PATCH response that omits the persisted price field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "group-buy-1",
          status: "APPROVED",
        },
      }),
    } as Response);

    await expect(
      adminApi.updateGroupBuy("group-buy-1", { priceKrw: 200000 }),
    ).rejects.toThrow("가격 계약");
  });

  it("allows an explicit null price but rejects an invalid persisted type", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: "group-buy-1",
            priceKrw: null,
            status: "APPROVED",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: "group-buy-1",
            priceKrw: "가격 미정",
            status: "APPROVED",
          },
        }),
      } as Response);

    await expect(
      adminApi.updateGroupBuy("group-buy-1", { priceKrw: null }),
    ).resolves.toMatchObject({ priceKrw: null });
    await expect(
      adminApi.updateGroupBuy("group-buy-1", { priceKrw: 200000 }),
    ).rejects.toThrow("가격 계약");
  });

  it("rejects conflicting camelCase and snake_case persisted prices", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "group-buy-1",
          priceKrw: 200000,
          price_krw: "199000",
          status: "APPROVED",
        },
      }),
    } as Response);

    await expect(
      adminApi.updateGroupBuy("group-buy-1", { priceKrw: 200000 }),
    ).rejects.toThrow("가격 계약");
  });

  it("rejects a malformed list row instead of normalizing its price to null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          items: [{ id: "group-buy-1", status: "APPROVED" }],
          total: 1,
        },
      }),
    } as Response);

    await expect(
      adminApi.listGroupBuys({ page: 1, limit: 25 }),
    ).rejects.toThrow("가격 계약");
  });
});
