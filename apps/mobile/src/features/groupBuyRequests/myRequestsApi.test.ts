import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMyGroupBuyRequests } from "./myRequestsApi";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../lib/postgrest-client", () => ({ postgrestFetch: request }));
const row = (id: string) => ({ request_id: id, product_name: "요청한 상품", status: "OPEN", requested_at: "2026-09-11T00:00:00.000Z" });
describe("my request pages", () => {
  beforeEach(() => request.mockReset());
  it("uses an account guard and the last visible row as the next cursor", async () => {
    request.mockResolvedValue({ data: Array.from({ length: 21 }, (_, i) => row(String(i))) });
    const page = await fetchMyGroupBuyRequests("owner");
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toEqual({ id: "19", requestedAt: "2026-09-11T00:00:00.000Z" });
    expect(request).toHaveBeenCalledWith("rpc/list_my_group_buy_requests", { method: "POST", body: {
      p_expected_user_id: "owner", p_after_id: null, p_after_requested_at: null, p_limit: 21,
    } });
    request.mockResolvedValue({ data: [row("20")] });
    expect((await fetchMyGroupBuyRequests("owner", page.nextCursor)).nextCursor).toBeNull();
    expect(request.mock.lastCall?.[1].body.p_after_id).toBe("19");
  });
  it("rejects malformed rows instead of presenting an empty or misleading history", async () => {
    request.mockResolvedValue({ data: [row("1"), { ...row("2"), status: "UNKNOWN" }] });
    await expect(fetchMyGroupBuyRequests("owner")).rejects.toThrow();
    request.mockResolvedValue({ data: { items: [] } });
    await expect(fetchMyGroupBuyRequests("owner")).rejects.toThrow();
  });
});
