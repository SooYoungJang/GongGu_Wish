import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapAdminUser } from "./userContract.ts";

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
    status: "ACTIVE",
  });
  assertEquals("pushToken" in result, false);
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
