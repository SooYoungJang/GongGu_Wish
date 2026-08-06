import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildMarketingConsentColumns,
  classifyPushRegistrationError,
  resolveAuthUserProfileEmail,
  toNotificationPreferenceColumns,
  validatePushRegistrationInput,
} from "./contract.ts";

Deno.test(
  "resolves a profile email for OAuth users without a top-level email",
  () => {
    assertEquals(
      resolveAuthUserProfileEmail({
        id: "user-123",
        email: null,
        user_metadata: { email: " Metadata@Example.COM " },
        identities: [],
      }),
      { email: "metadata@example.com", source: "metadata" },
    );
    assertEquals(
      resolveAuthUserProfileEmail({
        id: "user-456",
        email: null,
        user_metadata: {},
        identities: [{ identity_data: { email: "identity@example.com" } }],
      }),
      { email: "identity@example.com", source: "identity" },
    );
    assertEquals(
      resolveAuthUserProfileEmail({
        id: "user-789",
        email: null,
        user_metadata: {},
        identities: [],
      }),
      { email: "user-789@oauth.gonggu.invalid", source: "synthetic" },
    );
  },
);

Deno.test("accepts a read-only authenticated preferences request", () => {
  assertEquals(validatePushRegistrationInput({ action: "read" }), {
    readOnly: true,
    token: null,
    tokenAction: "preserve",
    preferences: null,
  });
});

Deno.test("classifies schema drift without exposing database details", () => {
  assertEquals(
    classifyPushRegistrationError(
      new Error(
        'column "submission_approval_notifications_enabled" does not exist',
      ),
    ),
    "SCHEMA_MISMATCH",
  );
  assertEquals(
    classifyPushRegistrationError(new Error("network timeout")),
    "PUSH_REGISTRATION_FAILED",
  );
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
        submissionApprovalEnabled: true,
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
        submissionApprovalEnabled: true,
        marketingPushEnabled: false,
        reminderDays: [3, 7],
        followedInfluencers: ["seller.one"],
        followedBrands: ["Brand A"],
      },
    },
  );
});

Deno.test("normalizes marketing push consent as a separate opt-in", () => {
  const registration = validatePushRegistrationInput({
    preferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      pushEnabled: true,
      marketingPushEnabled: true,
    },
  });

  assertEquals(registration.preferences?.marketingPushEnabled, true);
});

Deno.test("records marketing consent changes and withdrawal timestamps", () => {
  assertEquals(
    buildMarketingConsentColumns(false, true, "2026-08-04T00:00:00.000Z"),
    {
      marketing_push_enabled: true,
      marketing_push_consent_at: "2026-08-04T00:00:00.000Z",
      marketing_push_consent_version: "2026-08-04",
      marketing_push_consent_source: "settings",
      marketing_push_withdrawn_at: null,
    },
  );
  assertEquals(
    buildMarketingConsentColumns(true, false, "2026-08-05T00:00:00.000Z"),
    {
      marketing_push_enabled: false,
      marketing_push_withdrawn_at: "2026-08-05T00:00:00.000Z",
    },
  );
  assertEquals(
    buildMarketingConsentColumns(true, true, "2026-08-05T00:00:00.000Z"),
    {},
  );
});

Deno.test(
  "does not let legacy preference sync overwrite marketing consent",
  () => {
    const columns = toNotificationPreferenceColumns({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      marketingPushEnabled: false,
    });

    assertEquals("marketing_push_enabled" in columns, false);
  },
);

Deno.test(
  "maps the legacy new-submission preference into approval alerts",
  () => {
    const registration = validatePushRegistrationInput({
      preferences: {
        pushEnabled: true,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: true,
        reminderDays: [1, 3, 7],
        followedInfluencers: [],
        followedBrands: [],
      },
    });

    assertEquals(registration.preferences?.submissionApprovalEnabled, true);
  },
);

Deno.test("rejects malformed preference fields and non-Expo tokens", () => {
  assertThrows(() =>
    validatePushRegistrationInput({
      token: "fcm-token",
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    }),
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminderDays: [],
      },
    }),
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminderDays: [2],
      },
    }),
  );
  assertThrows(() =>
    validatePushRegistrationInput({
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        followedBrands: "not-an-array",
      },
    }),
  );
});
