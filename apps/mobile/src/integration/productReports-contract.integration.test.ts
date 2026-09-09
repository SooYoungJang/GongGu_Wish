import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, invokeAdmin, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;
describeLocal("product information report contracts", () => {
  let fixture: LocalSupabaseFixture;
  async function request(path: string, method: string, body?: unknown, token?: string, service = false) {
    const config = getLocalSupabaseConfig();
    const key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const submit = (id: string, reason: string, owner = fixture.adminUserId, token = fixture.adminAccessToken) =>
    request("rpc/submit_product_report", "POST", { p_expected_user_id: owner, p_group_buy_id: id, p_reason: reason }, token);
  beforeAll(async () => { fixture = await createLocalFixture(getLocalSupabaseConfig()); });
  afterAll(async () => { if (fixture) await cleanupLocalFixture(getLocalSupabaseConfig(), fixture); });

  it("deduplicates submissions, denies forgery, and leaves the product visible", async () => {
    const first = await submit(fixture.groupBuyIds[0], "PRICE");
    expect(first.status).toBe(200);
    const duplicate = await submit(fixture.groupBuyIds[0], "PRICE");
    expect(duplicate.data).toEqual(first.data);
    expect(first.data[0].status).toBe("OPEN");
    expect((await submit(fixture.groupBuyIds[0], "OTHER")).status).toBe(400);
    expect((await submit(fixture.groupBuyIds[0], "LINK", "00000000-0000-4000-8000-000000000001")).status).toBe(403);
    const anonymous = await request("rpc/submit_product_report", "POST", { p_expected_user_id: fixture.adminUserId, p_group_buy_id: fixture.groupBuyIds[0], p_reason: "LINK" });
    expect([401, 403]).toContain(anonymous.status);
    const forged = await request("product_information_reports", "POST", { user_id: fixture.adminUserId, group_buy_id: fixture.groupBuyIds[0], reason: "PRICE", status: "RESOLVED" }, fixture.adminAccessToken);
    expect(forged.status).toBe(403);
    const changed = await request(`product_information_reports?id=eq.${first.data[0].id}`, "PATCH", { status: "RESOLVED" }, fixture.adminAccessToken);
    expect(changed.status).toBe(403);
    const publicProduct = await request(`group_buys?id=eq.${fixture.groupBuyIds[0]}&select=id,status`, "GET");
    expect(publicProduct.data).toEqual([{ id: fixture.groupBuyIds[0], status: "APPROVED" }]);
  });

  it("caps concurrent submissions at fifteen per account per day", async () => {
    const reasons = ["PRICE", "SOLD_OUT", "ENDED", "LINK"];
    const combinations = fixture.groupBuyIds.slice(0, 4).flatMap(id => reasons.map(reason => ({ id, reason })));
    const results = await Promise.all(combinations.map(({ id, reason }) => submit(id, reason)));
    expect(results.filter(result => result.status === 200)).toHaveLength(15);
    expect(results.filter(result => result.status === 429)).toHaveLength(1);
    const rows = await request(`product_information_reports?user_id=eq.${fixture.adminUserId}&select=id`, "GET", undefined, fixture.adminAccessToken);
    expect(rows.data).toHaveLength(15);
  });

  it("lets only administrators review once and records the decision without changing the product", async () => {
    const config = getLocalSupabaseConfig();
    const list = await invokeAdmin<{ items: Array<{ id: string; status: string }>; total: number }>(config, fixture, "report-list", {
      path: "/admin/product-reports", method: "GET", params: { status: "OPEN", limit: 25, page: 1 },
    });
    expect(list.total).toBe(15);
    const id = list.items[0].id;
    const reviewed = await invokeAdmin<{ status: string; reviewedAt: string; reviewNote: string }>(config, fixture, "report-review", {
      path: `/admin/product-reports/${id}`, method: "PATCH", body: { status: "RESOLVED", reviewNote: "판매 페이지 확인 후 수정" },
    });
    expect(reviewed.status).toBe("RESOLVED");
    expect(reviewed.reviewNote).toBe("판매 페이지 확인 후 수정");
    expect(reviewed.reviewedAt).toEqual(expect.any(String));
    await expect(invokeAdmin(config, fixture, "report-conflict", {
      path: `/admin/product-reports/${id}`, method: "PATCH", body: { status: "DISMISSED" },
    })).rejects.toThrow();
    const anonymous = await fetch(`${config.url}/functions/v1/admin-api`, {
      method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/admin/product-reports", method: "GET" }),
    });
    expect([401, 403]).toContain(anonymous.status);
  });
});
