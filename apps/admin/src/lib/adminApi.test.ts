import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
});

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: { getSession },
  },
}));

import { adminApi } from "./adminApi";

describe("adminApi.updateGroupBuy", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "admin-token" } },
      error: null,
    });
    vi.restoreAllMocks();
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
});
