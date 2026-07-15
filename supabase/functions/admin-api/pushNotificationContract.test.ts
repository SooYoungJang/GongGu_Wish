import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isExpoPushToken,
  validatePushNotificationInput,
} from "./pushNotificationContract.ts";

Deno.test("accepts a broadcast with trimmed text and JSON data", () => {
  assertEquals(
    validatePushNotificationInput({
      title: "  새 공구 오픈  ",
      body: "  지금 확인해보세요.  ",
      data: { screen: "Home", groupBuyId: "group-buy-1" },
      userIds: [],
    }),
    {
      title: "새 공구 오픈",
      body: "지금 확인해보세요.",
      data: { screen: "Home", groupBuyId: "group-buy-1" },
      userIds: null,
    },
  );
});

Deno.test("normalizes selected user IDs for targeted delivery", () => {
  assertEquals(
    validatePushNotificationInput({
      title: "개별 안내",
      body: "선택 사용자에게만 보냅니다.",
      userIds: [" user-1 ", "user-1", "user-2"],
    }).userIds,
    ["user-1", "user-2"],
  );
});

Deno.test("rejects missing or oversized notification fields", () => {
  assertThrows(() =>
    validatePushNotificationInput({ title: "", body: "본문" }),
  );
  assertThrows(() =>
    validatePushNotificationInput({ title: "제목", body: "x".repeat(1001) }),
  );
  assertThrows(() =>
    validatePushNotificationInput({ title: "제목", body: "본문", data: [] }),
  );
});

Deno.test("accepts Expo and Exponent token prefixes only", () => {
  assertEquals(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assertEquals(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assertEquals(isExpoPushToken("fcm-device-token"), false);
  assertEquals(isExpoPushToken(null), false);
});
