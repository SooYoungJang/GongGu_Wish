import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, invokeAdmin, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;
describeLocal.sequential("request fulfillment and opt-in contracts", () => {
  let fixture: LocalSupabaseFixture;
  const requestId = randomUUID();
  async function request(path: string, method: string, body?: unknown, token?: string, service = false) {
    const config = getLocalSupabaseConfig(), key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const preference = (enabled: boolean, owner = fixture.adminUserId) => request("rpc/set_my_request_notification", "POST", { p_expected_user_id: owner, p_request_id: requestId, p_enabled: enabled }, fixture.adminAccessToken);
  beforeAll(async () => {
    fixture = await createLocalFixture(getLocalSupabaseConfig());
    expect((await request("group_buy_requests", "POST", { id: requestId, product_name: `완료-${requestId}`, product_name_norm: `완료-${requestId}` }, undefined, true)).status).toBe(201);
    expect((await request("group_buy_request_participations", "POST", { request_id: requestId, user_id: fixture.adminUserId, session_hashes: [`\\x${"1".repeat(64)}`], ip_hash: `\\x${"2".repeat(64)}` }, undefined, true)).status).toBe(201);
  });
  afterAll(async () => {
    if (!fixture) return;
    await request(`group_buy_requests?id=eq.${requestId}`, "DELETE", undefined, undefined, true);
    await cleanupLocalFixture(getLocalSupabaseConfig(), fixture);
  });
  it("starts opted out and blocks forged preferences and direct fulfillment", async () => {
    const rows = await request("rpc/list_my_group_buy_requests_v2", "POST", { p_expected_user_id: fixture.adminUserId }, fixture.adminAccessToken);
    expect(rows.status).toBe(200);
    expect(rows.data[0]).toMatchObject({ notification_enabled: false, group_buy_id: null });
    expect((await preference(true, randomUUID())).status).toBe(403);
    expect((await request("rpc/fulfill_group_buy_request", "POST", { p_request_id: requestId, p_group_buy_id: fixture.groupBuyIds[0] }, fixture.adminAccessToken)).status).toBe(403);
    expect((await request("group_buy_request_notification_preferences", "POST", { request_id: requestId, user_id: fixture.adminUserId, enabled: true }, fixture.adminAccessToken)).status).toBe(403);
    expect((await preference(true)).data).toBe(true);
  });
  it("atomically links an approved product and enqueues only once across concurrent retries", async () => {
    const config = getLocalSupabaseConfig();
    await expect(invokeAdmin(config, fixture, "bad-fulfillment", { path: `/admin/group-buy-requests/${requestId}/fulfill`, method: "POST", body: { groupBuyId: "missing-product" } })).rejects.toThrow();
    const results = await Promise.all(Array.from({ length: 3 }, () => invokeAdmin<{ queued: number }>(config, fixture, "fulfillment", { path: `/admin/group-buy-requests/${requestId}/fulfill`, method: "POST", body: { groupBuyId: fixture.groupBuyIds[0] } })));
    expect(results.reduce((sum, result) => sum + result.queued, 0)).toBe(1);
    const outbox = await request(`request_fulfillment_push_outbox?request_id=eq.${requestId}&select=id,user_id`, "GET", undefined, undefined, true);
    expect(outbox.data).toHaveLength(1);
    expect(outbox.data[0].user_id).toBe(fixture.adminUserId);
    const list = await request("rpc/list_my_group_buy_requests_v2", "POST", { p_expected_user_id: fixture.adminUserId }, fixture.adminAccessToken);
    expect(list.data[0]).toMatchObject({ status: "FULFILLED", group_buy_id: fixture.groupBuyIds[0], notification_enabled: true });
    await expect(invokeAdmin(config, fixture, "conflicting-fulfillment", { path: `/admin/group-buy-requests/${requestId}/fulfill`, method: "POST", body: { groupBuyId: fixture.groupBuyIds[1] } })).rejects.toThrow();
  });
  it("allows opt-out after fulfillment and hides a product that is no longer approved", async () => {
    expect((await preference(true)).status).toBe(409);
    expect((await preference(false)).data).toBe(false);
    const claimed = await request("rpc/claim_request_fulfillment_push_events", "POST", { p_limit: 100 }, undefined, true);
    expect(claimed.status).toBe(200);
    expect(claimed.data.some((row: { request_id: string }) => row.request_id === requestId)).toBe(false);
    await request(`group_buys?id=eq.${fixture.groupBuyIds[0]}`, "PATCH", { status: "REJECTED" }, undefined, true);
    const list = await request("rpc/list_my_group_buy_requests_v2", "POST", { p_expected_user_id: fixture.adminUserId }, fixture.adminAccessToken);
    expect(list.data[0]).toMatchObject({ status: "FULFILLED", group_buy_id: null, notification_enabled: false });
  });
});
