import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  validatePushRegistrationInput,
} from "./contract.ts";

Deno.test("accepts a read-only authenticated preferences request", () => {
  assertEquals(validatePushRegistrationInput({ action: "read" }), {
    readOnly: true,
    token: null,
    tokenAction: "preserve",
    preferences: null,
  });
});

Deno.test("keeps legacy token registration backward compatible", () => {
  assertEquals(
    validatePushRegistrationInput({
      token: "ExpoPushToken[valid-token]",
      provider: "expo",
    }),
    {
      readOnly: false,
      token: "ExpoPushToken[valid-token]",
      tokenAction: "set",
      preferences: null,
    },
  );
});

Deno.test("normalizes authenticated preference sync without a token", () => {
  assertEquals(
    validatePushRegistrationInput({
      preferences: {
        pushEnabled: false,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: false,
        reminderDays: [7, 3, 7],
        followedInfluencers: [" @Seller.One ", "seller.one"],
        followedBrands: [" Brand A ", "brand a"],
      },
    }),
    {
      readOnly: false,
      token: null,
      tokenAction: "clear",
      preferences: {
        pushEnabled: false,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: false,
        reminderDays: [3, 7],
        followedInfluencers: ["seller.one"],
        followedBrands: ["Brand A"],
      },
    },
  );
});

Deno.test("rejects malformed preference fields and non-Expo tokens", () => {
  assertThrows(() =>
    validatePushRegistrationInput({
      token: "fcm-token",
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    })
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminderDays: [],
      },
    })
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminderDays: [2],
      },
    })
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        followedBrands: "not-an-array",
      },
    })
  );
});
