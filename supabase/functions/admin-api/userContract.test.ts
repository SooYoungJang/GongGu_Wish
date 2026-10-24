import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapAdminUser, mapAdminUsersWithAccess } from "./userContract.ts";

Deno.test("maps push availability without exposing the raw token", () => {
  const result = mapAdminUser({
    id: "user-1",
    email: "user@example.com",
    nickname: "테스터",
    fcm_token: "legacy-token",
    push_token: "ExpoPushToken[valid-token]",
    push_provider: "expo",
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    status: "ACTIVE",
  });

  assertEquals(result, {
    id: "user-1",
    email: "user@example.com",
    nickname: "테스터",
    fcmToken: "legacy-token",
    hasPushToken: true,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    lastAccessAt: null,
    status: "ACTIVE",
  });
  assertEquals("pushToken" in result, false);
});

Deno.test("batches access times and preserves users, ordering and unknown timestamps", async () => {
  let calls = 0;
  const items = await mapAdminUsersWithAccess([{ id: "b" }, { id: "a" }, { id: "legacy" }], ids => {
    calls++;
    assertEquals(ids, ["b", "a", "legacy"]);
    return Promise.resolve({ data: [
      { user_id: "a", last_access_at: "2026-10-25T00:01:02Z" },
      { user_id: "b", last_access_at: "2026-10-24T23:59:59Z" },
      { user_id: "unrequested", last_access_at: "2026-10-25T01:00:00Z" },
    ], error: null });
  });
  assertEquals(calls, 1);
  assertEquals(items.map(item => [item.id, item.lastAccessAt]), [
    ["b", "2026-10-24T23:59:59Z"], ["a", "2026-10-25T00:01:02Z"], ["legacy", null],
  ]);
});

Deno.test("skips empty pages and reports failed access lookups", async () => {
  assertEquals(await mapAdminUsersWithAccess([], () => { throw new Error("Unexpected query"); }), []);
  await assertRejects(() => mapAdminUsersWithAccess([{ id: "a" }], () => Promise.resolve({
    data: null, error: { message: "Access lookup failed" },
  })), Error, "Access lookup failed");
  await assertRejects(() => mapAdminUsersWithAccess([{ id: "a" }], () => Promise.resolve({
    data: null, error: null,
  })), Error, "Invalid user access response");
});

Deno.test("does not mark a legacy or malformed token as Expo-ready", () => {
  assertEquals(
    mapAdminUser({
      id: "user-2",
      fcm_token: "legacy-token",
      push_token: "not-a-push-token",
      push_provider: "expo",
    }).hasPushToken,
    false,
  );
});
