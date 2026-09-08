import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

describeLocal("account bookmark ownership contract", () => {
  let fixture: LocalSupabaseFixture;
  let otherUserId: string | null = null;
  let otherToken = "";

  async function request(path: string, method = "GET", body?: unknown, token?: string, service = false) {
    const config = getLocalSupabaseConfig(); // Rejects remote hosts before mutations.
    const key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  function save(userId: string, id: string, selected: boolean, token = fixture.adminAccessToken) {
    return request("/rest/v1/rpc/set_my_bookmark", "POST", { p_expected_user_id: userId, p_group_buy_id: id, p_selected: selected }, token);
  }
  function list(userId: string, token = fixture.adminAccessToken, after: string | null = null, limit = 100) {
    return request("/rest/v1/rpc/list_my_bookmarks", "POST", { p_expected_user_id: userId, p_after_id: after, p_limit: limit }, token);
  }

  beforeAll(async () => {
    fixture = await createLocalFixture(getLocalSupabaseConfig());
    const suffix = randomUUID();
    const email = `bookmark-${suffix}@example.test`;
    const password = `Bookmark!${suffix}`;
    const created = await request("/auth/v1/admin/users", "POST", { email, password, email_confirm: true }, undefined, true);
    expect(created.status).toBe(200);
    otherUserId = created.data.id;
    const session = await request("/auth/v1/token?grant_type=password", "POST", { email, password });
    expect(session.status).toBe(200);
    otherToken = session.data.access_token;
  });
  afterAll(async () => {
    if (otherUserId) await request(`/auth/v1/admin/users/${otherUserId}`, "DELETE", undefined, undefined, true);
    if (fixture) await cleanupLocalFixture(getLocalSupabaseConfig(), fixture);
  });

  it("restores only the owner, bounds pages, and rejects stale-account writes", async () => {
    for (const id of fixture.groupBuyIds.slice(0, 3)) expect((await save(fixture.adminUserId, id, true)).status).toBe(204);
    expect((await save(fixture.adminUserId, fixture.groupBuyIds[0], true)).status).toBe(204);
    const first = await list(fixture.adminUserId, fixture.adminAccessToken, null, 2);
    expect(first.status).toBe(200);
    expect(first.data).toHaveLength(2);
    const second = await list(fixture.adminUserId, fixture.adminAccessToken, first.data[1].group_buy_id, 2);
    expect(second.data).toHaveLength(1);
    const all = [...first.data, ...second.data];
    expect(new Set(all.map(row => row.group_buy_id)).size).toBe(3);
    expect(all[0].snapshot.id).toBe(all[0].group_buy_id);
    expect(all[0].snapshot).not.toHaveProperty("reviewed_by");
    expect((await list(otherUserId!, otherToken)).data).toEqual([]);
    expect((await list(fixture.adminUserId, otherToken)).status).toBe(403);
    expect((await save(fixture.adminUserId, fixture.groupBuyIds[0], false, otherToken)).status).toBe(403);
    const hidden = await request(`/rest/v1/account_bookmarks?user_id=eq.${fixture.adminUserId}`, "GET", undefined, otherToken);
    expect(hidden.data).toEqual([]);
    const forged = await request("/rest/v1/account_bookmarks", "POST", { user_id: otherUserId, group_buy_id: fixture.groupBuyIds[0], snapshot: {} }, otherToken);
    expect(forged.status).toBe(403);
    const anonymous = await request("/rest/v1/rpc/list_my_bookmarks", "POST", { p_expected_user_id: fixture.adminUserId });
    expect([401, 403]).toContain(anonymous.status);
  });

  it("makes removals idempotent and erases bookmarks when the account is deleted", async () => {
    const id = fixture.groupBuyIds[0];
    expect((await save(otherUserId!, id, true, otherToken)).status).toBe(204);
    expect((await save(otherUserId!, id, false, otherToken)).status).toBe(204);
    expect((await save(otherUserId!, id, false, otherToken)).status).toBe(204);
    expect((await list(otherUserId!, otherToken)).data).toEqual([]);
    expect((await save(otherUserId!, id, true, otherToken)).status).toBe(204);
    const deletedId = otherUserId;
    expect((await request(`/auth/v1/admin/users/${deletedId}`, "DELETE", undefined, undefined, true)).status).toBe(200);
    otherUserId = null;
    const rows = await request(`/rest/v1/account_bookmarks?user_id=eq.${deletedId}`, "GET", undefined, undefined, true);
    expect(rows.data).toEqual([]);
    expect((await list(fixture.adminUserId)).data).toHaveLength(3);
  });
});
