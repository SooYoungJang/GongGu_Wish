import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

describeLocal("recent user access privacy and admin contract", () => {
  let fixture: LocalSupabaseFixture;
  let userId: string | null = null;
  let token = "";
  let email = "";

  async function request(path: string, method = "GET", body?: unknown, authToken?: string, service = false) {
    const config = getLocalSupabaseConfig(); // Fixture writes are restricted to a local stack.
    const key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${authToken ?? key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const accessTimes = (ids: string[]) => request("/rest/v1/rpc/admin_user_access_times", "POST", { p_user_ids: ids }, undefined, true);
  const record = (id: string, authToken = token) => request("/rest/v1/rpc/record_user_app_access", "POST", { p_expected_user_id: id }, authToken);

  beforeAll(async () => {
    fixture = await createLocalFixture(getLocalSupabaseConfig());
    const suffix = randomUUID();
    email = `app-access-${suffix}@example.test`;
    const password = `Access!${suffix}`;
    const created = await request("/auth/v1/admin/users", "POST", { email, password, email_confirm: true }, undefined, true);
    expect(created.status).toBe(200);
    userId = created.data.id;
    const session = await request("/auth/v1/token?grant_type=password", "POST", { email, password });
    expect(session.status).toBe(200);
    token = session.data.access_token;
  });
  afterAll(async () => {
    if (userId) await request(`/auth/v1/admin/users/${userId}`, "DELETE", undefined, undefined, true);
    if (fixture) await cleanupLocalFixture(getLocalSupabaseConfig(), fixture);
  });

  it("uses successful sign-in history for older clients and accepts legacy profile IDs", async () => {
    const account = await request(`/auth/v1/admin/users/${userId}`, "GET", undefined, undefined, true);
    const result = await accessTimes([userId!, "legacy-cuid", "malformed-id"]);
    expect(result.status).toBe(200);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].user_id).toBe(userId);
    expect(new Date(result.data[0].last_access_at).getTime()).toBe(new Date(account.data.last_sign_in_at).getTime());
  });

  it("prevents anonymous or cross-account writes and ordinary users from reading access times", async () => {
    const anonymous = await request("/rest/v1/rpc/record_user_app_access", "POST", { p_expected_user_id: userId });
    expect([401, 403]).toContain(anonymous.status);
    expect((await record(fixture.adminUserId)).status).toBe(403);
    expect((await request("/rest/v1/rpc/admin_user_access_times", "POST", { p_user_ids: [userId] }, token)).status).toBe(403);
    const hidden = await request("/rest/v1/user_app_activity?select=*", "GET", undefined, token);
    expect(hidden.status).toBe(403);
    const forged = await request("/rest/v1/user_app_activity", "POST", { user_id: userId, last_access_at: "2099-01-01T00:00:00Z" }, token);
    expect(forged.status).toBe(403);
  });

  it("keeps one monotonic server timestamp and includes it in admin list and update responses", async () => {
    const before = Date.now();
    expect((await record(userId!)).status).toBe(204);
    const first = await accessTimes([userId!]);
    expect((await record(userId!)).status).toBe(204);
    const second = await accessTimes([userId!]);
    const timestamp = second.data[0].last_access_at;
    expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(first.data[0].last_access_at).getTime());
    const stored = await request(`/rest/v1/user_app_activity?user_id=eq.${userId}`, "GET", undefined, undefined, true);
    expect(stored.data).toHaveLength(1);

    const listed = await request("/functions/v1/admin-api", "POST", { path: "/admin/users", method: "GET", params: { q: email } }, fixture.adminAccessToken);
    expect(listed.status).toBe(200);
    expect(listed.data.data.items).toHaveLength(1);
    expect(listed.data.data.items[0].lastAccessAt).toBe(timestamp);
    const updated = await request("/functions/v1/admin-api", "POST", { path: `/admin/users/${userId}`, method: "PATCH", body: { nickname: "Access test" } }, fixture.adminAccessToken);
    expect(updated.status).toBe(200);
    expect(updated.data.data.lastAccessAt).toBe(timestamp);
  });

  it("erases the single access record when its Auth account is deleted", async () => {
    expect((await record(userId!)).status).toBe(204);
    const deletedId = userId;
    expect((await request(`/auth/v1/admin/users/${deletedId}`, "DELETE", undefined, undefined, true)).status).toBe(200);
    userId = null;
    const stored = await request(`/rest/v1/user_app_activity?user_id=eq.${deletedId}`, "GET", undefined, undefined, true);
    expect(stored.data).toEqual([]);
    expect((await accessTimes([deletedId!])).data).toEqual([]);
  });
});
