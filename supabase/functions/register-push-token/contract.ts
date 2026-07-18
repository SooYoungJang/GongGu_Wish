export const NOTIFICATION_REMINDER_DAYS = [1, 3, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];

export type NotificationPreferences = {
  pushEnabled: boolean;
  deadlineRemindersEnabled: boolean;
  newSubmissionsEnabled: boolean;
  reminderDays: NotificationReminderDay[];
  followedInfluencers: string[];
  followedBrands: string[];
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  deadlineRemindersEnabled: false,
  newSubmissionsEnabled: false,
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
    const normalized = kind === "influencer"
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

function validatePreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    throw new Error("알림 설정이 올바르지 않습니다.");
  }
  const pushEnabled = value.pushEnabled;
  const deadlineRemindersEnabled = value.deadlineRemindersEnabled;
  const newSubmissionsEnabled = value.newSubmissionsEnabled;
  if (typeof pushEnabled !== "boolean") {
    throw new Error("pushEnabled 값은 boolean이어야 합니다.");
  }
  if (typeof deadlineRemindersEnabled !== "boolean") {
    throw new Error("deadlineRemindersEnabled 값은 boolean이어야 합니다.");
  }
  if (typeof newSubmissionsEnabled !== "boolean") {
    throw new Error("newSubmissionsEnabled 값은 boolean이어야 합니다.");
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
    newSubmissionsEnabled,
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

  const preferences = value.preferences === undefined
    ? null
    : validatePreferences(value.preferences);
  if (!hasToken && !preferences) {
    throw new Error("푸시 토큰 또는 알림 설정이 필요합니다.");
  }

  const tokenAction = preferences?.pushEnabled === false
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
    pushEnabled: typeof columns.push_enabled === "boolean"
      ? columns.push_enabled
      : false,
    deadlineRemindersEnabled:
      typeof columns.deadline_reminders_enabled === "boolean"
        ? columns.deadline_reminders_enabled
        : false,
    newSubmissionsEnabled: typeof columns.new_submissions_enabled === "boolean"
      ? columns.new_submissions_enabled
      : false,
    reminderDays: columns.notification_reminder_days ??
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
    new_submissions_enabled: preferences.newSubmissionsEnabled,
    notification_reminder_days: preferences.reminderDays,
    followed_influencers: preferences.followedInfluencers,
    followed_brands: preferences.followedBrands,
  };
}
