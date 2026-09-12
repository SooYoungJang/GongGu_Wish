import { randomUUID, createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupLocalFixture, createLocalFixture, getLocalSupabaseConfig, hasLocalSupabaseConfig, invokeAdmin, type LocalSupabaseFixture } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;
describeLocal.sequential("private application telemetry contracts", () => {
  let fixture: LocalSupabaseFixture;
  const sessionId = randomUUID(), source = createHash("sha256").update(sessionId).digest("hex");
  const event = () => ({ id: randomUUID(), eventName: "query_error", screen: "SearchScreen", appVersion: "0.0.0-test", releaseId: "native", platform: "android", errorKind: "ApiError", httpStatus: 503, value: null });
  async function request(path: string, body?: unknown, service = false, method = "POST", token?: string) {
    const config = getLocalSupabaseConfig(), key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.text();
    return { status: response.status, data: raw ? JSON.parse(raw) : null };
  }
  beforeAll(async () => { fixture = await createLocalFixture(getLocalSupabaseConfig()); });
  afterAll(async () => {
    await request(`rest/v1/app_telemetry_events?session_id=eq.${sessionId}`, undefined, true, "DELETE");
    await request(`rest/v1/app_telemetry_rate_limits?source_hash=eq.${source}`, undefined, true, "DELETE");
    if (fixture) await cleanupLocalFixture(getLocalSupabaseConfig(), fixture);
  });
  it("rejects public table access and aggregate RPC calls, including signed-in clients", async () => {
    for (const token of [undefined, fixture.adminAccessToken]) {
      const deniedStatus = token ? 403 : 401;
      expect((await request("rest/v1/app_telemetry_events?select=id", undefined, false, "GET", token)).status).toBe(deniedStatus);
      expect((await request("rest/v1/rpc/get_app_telemetry_summary", {}, false, "POST", token)).status).toBe(deniedStatus);
      expect((await request("rest/v1/rpc/ingest_app_telemetry", { p_source_hash: source, p_session_id: sessionId, p_events: [event()] }, false, "POST", token)).status).toBe(deniedStatus);
    }
  });
  it("ingests through the real Edge handler, deduplicates retries and exposes only admin aggregates", async () => {
    const batch = { sessionId, events: [event()] };
    expect((await request("functions/v1/app-telemetry", batch)).data.accepted).toBe(1);
    expect((await request("functions/v1/app-telemetry", batch)).data.accepted).toBe(0);
    const rows = await request(`rest/v1/app_telemetry_events?session_id=eq.${sessionId}`, undefined, true, "GET");
    expect(rows.data).toHaveLength(1);
    const summary = await invokeAdmin<{ items: Array<Record<string, unknown>> }>(getLocalSupabaseConfig(), fixture, "telemetry-summary", { path: "/admin/app-diagnostics", method: "GET", params: { days: 7 } });
    expect(summary.items).toEqual(expect.arrayContaining([expect.objectContaining({ appVersion: "0.0.0-test", errorKind: "ApiError", count: 1, sessions: 1 })]));
    expect(JSON.stringify(summary)).not.toContain(sessionId);
    expect((await request("functions/v1/app-telemetry", { ...batch, events: [{ ...event(), message: "secret" }] })).status).toBe(400);
    expect((await request("functions/v1/admin-api", { path: "/admin/app-diagnostics", method: "GET" })).status).toBe(401);
  });
  it("enforces a transactional quota under concurrent writes and rejects non-allowlisted fields", async () => {
    const body = (events: unknown[]) => ({ p_source_hash: source, p_session_id: sessionId, p_events: events });
    expect((await request("rest/v1/rpc/ingest_app_telemetry", body([{ ...event(), email: "private" }]), true)).status).toBe(400);
    for (let i = 0; i < 14; i++) expect((await request("rest/v1/rpc/ingest_app_telemetry", body(Array.from({ length: 20 }, event)), true)).status).toBe(200);
    const results = await Promise.all([1, 2].map(() => request("rest/v1/rpc/ingest_app_telemetry", body(Array.from({ length: 20 }, event)), true)));
    expect(results.map(r => r.status).sort()).toEqual([200, 429]);
    const rows = await request(`rest/v1/app_telemetry_events?session_id=eq.${sessionId}&select=id`, undefined, true, "GET");
    expect(rows.data).toHaveLength(301);
  });
});
