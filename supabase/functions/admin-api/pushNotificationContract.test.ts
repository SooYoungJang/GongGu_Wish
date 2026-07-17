import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isExpoPushToken,
  matchesPushPreferences,
  validatePushNotificationInput,
} from "./pushNotificationContract.ts";

Deno.test("accepts a broadcast with trimmed text and JSON data", () => {
  assertEquals(
    validatePushNotificationInput({
      title: "  새 공구 오픈  ",
      body: "  지금 확인해보세요.  ",
      data: { screen: "Home", groupBuyId: "group-buy-1" },
    }),
    {
      title: "새 공구 오픈",
      body: "지금 확인해보세요.",
      data: { screen: "Home", groupBuyId: "group-buy-1" },
      userIds: null,
      audience: { type: "general" },
    },
  );
});

Deno.test("rejects an explicitly empty targeted recipient list", () => {
  assertThrows(() =>
    validatePushNotificationInput({
      title: "개별 안내",
      body: "선택 사용자에게만 보냅니다.",
      userIds: [],
    })
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
    validatePushNotificationInput({ title: "", body: "본문" })
  );
  assertThrows(() =>
    validatePushNotificationInput({ title: "제목", body: "x".repeat(1001) })
  );
  assertThrows(() =>
    validatePushNotificationInput({ title: "제목", body: "본문", data: [] })
  );
  assertThrows(() =>
    validatePushNotificationInput({
      title: "제목",
      body: "본문",
      data: { message: "가".repeat(800) },
    })
  );
});

Deno.test("accepts Expo and Exponent token prefixes only", () => {
  assertEquals(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assertEquals(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assertEquals(isExpoPushToken("fcm-device-token"), false);
  assertEquals(isExpoPushToken(null), false);
});

Deno.test("validates preference-aware notification audiences", () => {
  assertEquals(
    validatePushNotificationInput({
      title: "신규 제보",
      body: "새 공구가 등록됐어요.",
      data: {
        notificationType: "new_submission",
        groupBuyId: "group-buy-1",
      },
    }).audience,
    { type: "new_submission" },
  );
  assertEquals(
    validatePushNotificationInput({
      title: "판매자 새 공구",
      body: "팔로우한 판매자의 공구가 등록됐어요.",
      data: {
        notificationType: "influencer",
        influencerUsername: " @Seller.One ",
      },
    }).audience,
    { type: "influencer", target: "seller.one" },
  );
  assertEquals(
    validatePushNotificationInput({
      title: "브랜드 새 공구",
      body: "팔로우한 브랜드 공구가 등록됐어요.",
      data: { notificationType: "brand", brandName: " Brand A " },
    }).audience,
    { type: "brand", target: "Brand A" },
  );
});

Deno.test("rejects malformed preference-aware targets", () => {
  assertThrows(() =>
    validatePushNotificationInput({
      title: "판매자 새 공구",
      body: "본문",
      data: {
        notificationType: "influencer",
        influencerUsername: "bad handle!",
      },
    })
  );
  assertThrows(() =>
    validatePushNotificationInput({
      title: "알 수 없는 유형",
      body: "본문",
      data: { notificationType: "unknown" },
    })
  );
});

Deno.test("filters recipients by global and type-specific preferences", () => {
  const base = {
    push_enabled: true,
    deadline_reminders_enabled: true,
    new_submissions_enabled: true,
    followed_influencers: ["seller.one"],
    followed_brands: ["Brand A"],
  };

  assertEquals(matchesPushPreferences(base, { type: "general" }), true);
  assertEquals(
    matchesPushPreferences(
      { ...base, new_submissions_enabled: false },
      { type: "new_submission" },
    ),
    false,
  );
  assertEquals(
    matchesPushPreferences(base, {
      type: "influencer",
      target: "SELLER.ONE",
    }),
    true,
  );
  assertEquals(
    matchesPushPreferences(base, { type: "brand", target: "brand a" }),
    true,
  );
  assertEquals(
    matchesPushPreferences(
      { ...base, new_submissions_enabled: false },
      { type: "brand", target: "brand a" },
    ),
    false,
  );
  assertEquals(
    matchesPushPreferences(
      { ...base, push_enabled: false },
      { type: "general" },
    ),
    false,
  );
});
