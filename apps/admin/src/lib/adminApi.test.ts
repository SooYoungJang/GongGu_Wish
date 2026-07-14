import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("sends priceKrw and normalizes the persisted response before the UI consumes it", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "group-buy-1",
          priceKrw: "25900",
          status: "APPROVED",
        },
      }),
    } as Response);

    const result = await adminApi.updateGroupBuy("group-buy-1", {
      priceKrw: 25900,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      body: { priceKrw: number };
    };
    expect(request.body.priceKrw).toBe(25900);
    expect(result.priceKrw).toBe(25900);
  });
});
