import assert from "node:assert/strict";
import test from "node:test";

import { runNotificationSmoke } from "./production-notification-smoke.mjs";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("notification smoke signs in, round-trips preferences, and restores the canary", async () => {
  const baseline = {
    pushEnabled: true,
    deadlineRemindersEnabled: false,
    submissionApprovalEnabled: false,
    marketingPushEnabled: false,
    reminderDays: [1, 3, 7],
    followedInfluencers: [],
    followedBrands: [],
  };
  let current = structuredClone(baseline);
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/auth/v1/token"))
      return response({ access_token: "smoke-token" });
    const body = JSON.parse(init.body);
    if (body.action === "read")
      return response({ data: { preferences: current } });
    current = body.preferences;
    return response({ data: { preferencesSynced: true, registered: false } });
  };

  const result = await runNotificationSmoke({
    supabaseUrl: "https://example.supabase.co/",
    anonKey: "anon-key",
    email: "canary@example.com",
    password: "canary-password",
    fetchImpl,
  });

  assert.deepEqual(result, { status: "passed" });
  assert.deepEqual(current, baseline);
  assert.equal(calls.length, 5);
  assert.match(calls[0].url, /auth\/v1\/token/);
  assert.ok(
    calls
      .filter(({ url }) => !url.includes("/auth/v1/token"))
      .every(({ init }) => !init.body.includes("canary-password")),
  );
});

test("notification smoke fails closed when a required secret is missing", async () => {
  await assert.rejects(
    runNotificationSmoke({
      supabaseUrl: "https://example.supabase.co",
      anonKey: "anon-key",
      email: "canary@example.com",
      password: "",
      fetchImpl: async () => response({}),
    }),
    /SUPABASE_SMOKE_PASSWORD is required/,
  );
});

test("notification smoke surfaces a stable backend error code without response details", async () => {
  const fetchImpl = async (url) =>
    url.includes("/auth/v1/token")
      ? response({ access_token: "smoke-token" })
      : response({ code: "SCHEMA_MISMATCH", error: "internal detail" }, 500);

  await assert.rejects(
    runNotificationSmoke({
      supabaseUrl: "https://example.supabase.co",
      anonKey: "anon-key",
      email: "canary@example.com",
      password: "canary-password",
      fetchImpl,
    }),
    /SCHEMA_MISMATCH \(500\)/,
  );
});
