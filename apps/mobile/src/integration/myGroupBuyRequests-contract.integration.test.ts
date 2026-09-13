import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;
describeLocal("my group-buy requests ownership and pagination", () => {
  let fixture: LocalSupabaseFixture;
  const ids = Array.from({ length: 4 }, () => randomUUID()).sort().reverse();
  const timestamp = "2026-09-01T00:00:00Z";
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
  beforeAll(async () => {
    fixture = await createLocalFixture(getLocalSupabaseConfig());
    expect((await request("group_buy_requests", "POST", ids.map((id, index) => ({ id, product_name: `내요청-${id}`, product_name_norm: `내요청-${id}`, status: ["OPEN", "FULFILLED", "HIDDEN", "OPEN"][index] })), undefined, true)).status).toBe(201);
    expect((await request("group_buy_request_participations", "POST", ids.map((id, index) => ({ request_id: id, user_id: index < 3 ? fixture.adminUserId : null, session_hashes: [`\\x${String(index + 1).repeat(64)}`], ip_hash: `\\x${String(index + 1).repeat(64)}`, requested_at: timestamp })), undefined, true)).status).toBe(201);
  });
  afterAll(async () => {
    if (!fixture) return;
    await request(`group_buy_requests?id=in.(${ids.join(",")})`, "DELETE", undefined, undefined, true);
    await cleanupLocalFixture(getLocalSupabaseConfig(), fixture);
  });
  it("returns only owned rows, including closed states, with stable tied-date pagination", async () => {
    const body = { p_expected_user_id: fixture.adminUserId, p_limit: 2 };
    const first = await request("rpc/list_my_group_buy_requests", "POST", body, fixture.adminAccessToken);
    expect(first.status).toBe(200);
    expect(first.data.map((row: { request_id: string }) => row.request_id)).toEqual(ids.slice(0, 2));
    const last = first.data[1];
    const second = await request("rpc/list_my_group_buy_requests", "POST", { ...body, p_after_id: last.request_id, p_after_requested_at: last.requested_at }, fixture.adminAccessToken);
    expect(second.status).toBe(200);
    expect(second.data).toHaveLength(1);
    expect(second.data[0]).toMatchObject({ request_id: ids[2], status: "HIDDEN" });
    expect(Object.keys(second.data[0]).sort()).toEqual(["product_name", "request_id", "requested_at", "status"]);
  });
  it("rejects anonymous requests, another account and malformed cursors without opening direct table access", async () => {
    const body = { p_expected_user_id: fixture.adminUserId };
    expect([401, 403]).toContain((await request("rpc/list_my_group_buy_requests", "POST", body)).status);
    expect((await request("rpc/list_my_group_buy_requests", "POST", { ...body, p_expected_user_id: randomUUID() }, fixture.adminAccessToken)).status).toBe(403);
    expect((await request("rpc/list_my_group_buy_requests", "POST", { ...body, p_after_id: ids[0] }, fixture.adminAccessToken)).status).toBe(400);
    expect((await request("group_buy_request_participations?select=user_id", "GET", undefined, fixture.adminAccessToken)).status).toBe(403);
  });
});
