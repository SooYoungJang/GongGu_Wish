export const NOTIFICATION_REMINDER_DAYS = [1, 3, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];

export type NotificationPreferences = {
  pushEnabled: boolean;
  deadlineRemindersEnabled: boolean;
  submissionApprovalEnabled: boolean;
  marketingPushEnabled: boolean;
  reminderDays: NotificationReminderDay[];
  followedInfluencers: string[];
  followedBrands: string[];
};

export const MARKETING_CONSENT_VERSION = "2026-08-04";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  deadlineRemindersEnabled: false,
  submissionApprovalEnabled: false,
  marketingPushEnabled: false,
  reminderDays: [1, 3, 7],
  followedInfluencers: [],
  followedBrands: [],
};

export type ValidatedPushRegistrationInput = {
  readOnly: boolean;
  token: string | null;
  tokenAction: "set" | "clear" | "preserve";
  preferences: NotificationPreferences | null;
};

const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;
const INFLUENCER_PATTERN = /^[a-z0-9._]+$/;
const MAX_TARGETS = 50;
const MAX_TARGET_LENGTH = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type AuthUserProfileEmail = {
  email: string;
  source: "auth" | "metadata" | "identity" | "synthetic";
};

function normalizeEmailCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) ? normalized : null;
}

export function resolveAuthUserProfileEmail(user: {
  id: string;
  email?: unknown;
  user_metadata?: unknown;
  identities?: unknown;
}): AuthUserProfileEmail {
  const authEmail = normalizeEmailCandidate(user.email);
  if (authEmail) return { email: authEmail, source: "auth" };

  const metadataEmail = isRecord(user.user_metadata)
    ? normalizeEmailCandidate(user.user_metadata.email)
    : null;
  if (metadataEmail) return { email: metadataEmail, source: "metadata" };

  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      const identityEmail =
        isRecord(identity) && isRecord(identity.identity_data)
          ? normalizeEmailCandidate(identity.identity_data.email)
          : null;
      if (identityEmail) return { email: identityEmail, source: "identity" };
    }
  }

  const normalizedId = user.id.trim().toLowerCase();
  if (!normalizedId) throw new Error("사용자 ID를 확인할 수 없습니다.");
  return {
    email: `${normalizedId}@oauth.gonggu.invalid`,
    source: "synthetic",
  };
}

function normalizeTargets(
  value: unknown,
  kind: "brand" | "influencer",
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${kind} 알림 대상은 배열이어야 합니다.`);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      throw new Error(`${kind} 알림 대상은 문자열이어야 합니다.`);
    }
    const compact = candidate.trim().replace(/\s+/g, " ");
    const normalized =
      kind === "influencer"
        ? compact.replace(/^@+/, "").toLowerCase()
        : compact;
    if (
      !normalized ||
      normalized.length > MAX_TARGET_LENGTH ||
      (kind === "influencer" && !INFLUENCER_PATTERN.test(normalized))
    ) {
      throw new Error(`${kind} 알림 대상이 올바르지 않습니다.`);
    }
    const identity = normalized.toLocaleLowerCase("en-US");
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(normalized);
    }
    if (result.length > MAX_TARGETS) {
      throw new Error(
        `알림 대상은 최대 ${MAX_TARGETS}개까지 저장할 수 있습니다.`,
      );
    }
  }
  return result;
}

export function buildMarketingConsentColumns(
  previousValue: unknown,
  nextValue: boolean,
  now: string,
) {
  const wasEnabled = previousValue === true;
  if (wasEnabled === nextValue) return {};
  if (nextValue) {
    return {
      marketing_push_enabled: true,
      marketing_push_consent_at: now,
      marketing_push_consent_version: MARKETING_CONSENT_VERSION,
      marketing_push_consent_source: "settings",
      marketing_push_withdrawn_at: null,
    };
  }
  return {
    marketing_push_enabled: false,
    marketing_push_withdrawn_at: now,
  };
}

function validatePreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    throw new Error("알림 설정이 올바르지 않습니다.");
  }
  const pushEnabled = value.pushEnabled;
  const deadlineRemindersEnabled = value.deadlineRemindersEnabled;
  const submissionApprovalEnabled =
    value.submissionApprovalEnabled ?? value.newSubmissionsEnabled;
  const marketingPushEnabled = value.marketingPushEnabled;
  if (typeof pushEnabled !== "boolean") {
    throw new Error("pushEnabled 값은 boolean이어야 합니다.");
  }
  if (typeof deadlineRemindersEnabled !== "boolean") {
    throw new Error("deadlineRemindersEnabled 값은 boolean이어야 합니다.");
  }
  if (typeof submissionApprovalEnabled !== "boolean") {
    throw new Error("submissionApprovalEnabled 값은 boolean이어야 합니다.");
  }
  if (
    marketingPushEnabled !== undefined &&
    typeof marketingPushEnabled !== "boolean"
  ) {
    throw new Error("marketingPushEnabled 값은 boolean이어야 합니다.");
  }
  if (!Array.isArray(value.reminderDays)) {
    throw new Error("알림 날짜 설정은 배열이어야 합니다.");
  }
  const allowed = new Set<number>(NOTIFICATION_REMINDER_DAYS);
  if (
    value.reminderDays.length === 0 ||
    !value.reminderDays.every(
      (day) => typeof day === "number" && allowed.has(day),
    )
  ) {
    throw new Error("알림 날짜는 D-1, D-3, D-7만 선택할 수 있습니다.");
  }

  return {
    pushEnabled,
    deadlineRemindersEnabled,
    submissionApprovalEnabled,
    marketingPushEnabled:
      typeof marketingPushEnabled === "boolean"
        ? marketingPushEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.marketingPushEnabled,
    reminderDays: [
      ...new Set(value.reminderDays as NotificationReminderDay[]),
    ].sort((left, right) => left - right),
    followedInfluencers: normalizeTargets(
      value.followedInfluencers,
      "influencer",
    ),
    followedBrands: normalizeTargets(value.followedBrands, "brand"),
  };
}

export function validatePushRegistrationInput(
  value: unknown,
): ValidatedPushRegistrationInput {
  if (!isRecord(value)) throw new Error("요청 본문이 올바르지 않습니다.");
  if (value.action === "read") {
    if (value.token !== undefined || value.preferences !== undefined) {
      throw new Error("조회 요청에는 변경 값을 포함할 수 없습니다.");
    }
    return {
      readOnly: true,
      token: null,
      tokenAction: "preserve",
      preferences: null,
    };
  }
  if (value.action !== undefined) {
    throw new Error("지원하지 않는 알림 설정 작업입니다.");
  }
  if (value.provider !== undefined && value.provider !== "expo") {
    throw new Error("지원하지 않는 푸시 제공자입니다.");
  }

  const hasToken = value.token !== undefined && value.token !== null;
  if (
    hasToken &&
    (typeof value.token !== "string" ||
      !EXPO_PUSH_TOKEN_PATTERN.test(value.token))
  ) {
    throw new Error("유효한 Expo Push Token이 필요합니다.");
  }

  const preferences =
    value.preferences === undefined
      ? null
      : validatePreferences(value.preferences);
  if (!hasToken && !preferences) {
    throw new Error("푸시 토큰 또는 알림 설정이 필요합니다.");
  }

  const tokenAction =
    preferences?.pushEnabled === false
      ? "clear"
      : hasToken
        ? "set"
        : "preserve";
  return {
    readOnly: false,
    token: tokenAction === "set" ? (value.token as string) : null,
    tokenAction,
    preferences,
  };
}

export function fromNotificationPreferenceColumns(
  columns: Record<string, unknown>,
) {
  return validatePreferences({
    pushEnabled:
      typeof columns.push_enabled === "boolean" ? columns.push_enabled : false,
    deadlineRemindersEnabled:
      typeof columns.deadline_reminders_enabled === "boolean"
        ? columns.deadline_reminders_enabled
        : false,
    submissionApprovalEnabled:
      typeof columns.submission_approval_notifications_enabled === "boolean"
        ? columns.submission_approval_notifications_enabled
        : typeof columns.new_submissions_enabled === "boolean"
          ? columns.new_submissions_enabled
          : false,
    marketingPushEnabled: columns.marketing_push_enabled === true,
    reminderDays:
      columns.notification_reminder_days ??
      DEFAULT_NOTIFICATION_PREFERENCES.reminderDays,
    followedInfluencers: columns.followed_influencers ?? [],
    followedBrands: columns.followed_brands ?? [],
  });
}

export function toNotificationPreferenceColumns(
  preferences: NotificationPreferences,
) {
  return {
    push_enabled: preferences.pushEnabled,
    deadline_reminders_enabled: preferences.deadlineRemindersEnabled,
    submission_approval_notifications_enabled:
      preferences.submissionApprovalEnabled,
    marketing_push_enabled: preferences.marketingPushEnabled,
    // One-release bridge for clients that still read the legacy preference.
    new_submissions_enabled: preferences.submissionApprovalEnabled,
    notification_reminder_days: preferences.reminderDays,
    followed_influencers: preferences.followedInfluencers,
    followed_brands: preferences.followedBrands,
  };
}
