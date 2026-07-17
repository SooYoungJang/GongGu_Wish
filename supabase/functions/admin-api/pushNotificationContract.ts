export const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;

export const MAX_PUSH_TITLE_LENGTH = 100;
export const MAX_PUSH_BODY_LENGTH = 1000;
export const MAX_PUSH_DATA_BYTES = 2048;
export const MAX_PUSH_TARGETS = 1000;

export type ValidatedPushNotificationInput = {
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  userIds: string[] | null;
  audience: PushPreferenceAudience;
};

export type PushPreferenceAudience =
  | { type: "general" }
  | { type: "new_submission" }
  | { type: "deadline" }
  | { type: "influencer"; target: string }
  | { type: "brand"; target: string };

const INFLUENCER_PATTERN = /^[a-z0-9._]+$/;
const MAX_AUDIENCE_TARGET_LENGTH = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && EXPO_PUSH_TOKEN_PATTERN.test(value);
}

function normalizeAudienceTarget(
  value: unknown,
  type: "brand" | "influencer",
) {
  if (typeof value !== "string") {
    throw new Error("푸시 알림 대상이 필요합니다.");
  }
  const compact = value.trim().replace(/\s+/g, " ");
  const normalized = type === "influencer"
    ? compact.replace(/^@+/, "").toLowerCase()
    : compact;
  if (
    !normalized ||
    normalized.length > MAX_AUDIENCE_TARGET_LENGTH ||
    (type === "influencer" && !INFLUENCER_PATTERN.test(normalized))
  ) {
    throw new Error("푸시 알림 대상이 올바르지 않습니다.");
  }
  return normalized;
}

function getPushPreferenceAudience(
  data: Record<string, unknown> | null,
): PushPreferenceAudience {
  const type = data?.notificationType;
  if (type === undefined || type === "general") return { type: "general" };
  if (type === "new_submission") return { type: "new_submission" };
  if (type === "deadline") return { type: "deadline" };
  if (type === "influencer") {
    return {
      type,
      target: normalizeAudienceTarget(data?.influencerUsername, type),
    };
  }
  if (type === "brand") {
    return {
      type,
      target: normalizeAudienceTarget(data?.brandName, type),
    };
  }
  throw new Error("지원하지 않는 알림 유형입니다.");
}

function hasFollowTarget(value: unknown, target: string) {
  if (!Array.isArray(value)) return false;
  const normalizedTarget = target.toLocaleLowerCase("en-US");
  return value.some(
    (candidate) =>
      typeof candidate === "string" &&
      candidate.trim().toLocaleLowerCase("en-US") === normalizedTarget,
  );
}

export function matchesPushPreferences(
  row: Record<string, unknown>,
  audience: PushPreferenceAudience,
) {
  if (row.push_enabled === false) return false;
  switch (audience.type) {
    case "general":
      return true;
    case "new_submission":
      return row.new_submissions_enabled !== false;
    case "deadline":
      return row.deadline_reminders_enabled !== false;
    case "influencer":
      return (
        row.new_submissions_enabled !== false &&
        hasFollowTarget(row.followed_influencers, audience.target)
      );
    case "brand":
      return (
        row.new_submissions_enabled !== false &&
        hasFollowTarget(row.followed_brands, audience.target)
      );
  }
}

export function validatePushNotificationInput(
  value: Record<string, unknown>,
): ValidatedPushNotificationInput {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";

  if (!title || title.length > MAX_PUSH_TITLE_LENGTH) {
    throw new Error(
      `푸시 제목은 1자 이상 ${MAX_PUSH_TITLE_LENGTH}자 이하로 입력해주세요.`,
    );
  }
  if (!body || body.length > MAX_PUSH_BODY_LENGTH) {
    throw new Error(
      `푸시 본문은 1자 이상 ${MAX_PUSH_BODY_LENGTH}자 이하로 입력해주세요.`,
    );
  }

  let data: Record<string, unknown> | null = null;
  if (value.data !== undefined && value.data !== null) {
    if (!isRecord(value.data)) {
      throw new Error("푸시 데이터는 JSON 객체여야 합니다.");
    }
    const serialized = JSON.stringify(value.data);
    if (new TextEncoder().encode(serialized).byteLength > MAX_PUSH_DATA_BYTES) {
      throw new Error(
        `푸시 데이터는 ${MAX_PUSH_DATA_BYTES}바이트 이하로 입력해주세요.`,
      );
    }
    data = value.data;
  }

  let userIds: string[] | null = null;
  if (value.userIds !== undefined && value.userIds !== null) {
    if (
      !Array.isArray(value.userIds) ||
      !value.userIds.every((id) => typeof id === "string" && id.trim())
    ) {
      throw new Error("푸시 대상 사용자 목록이 올바르지 않습니다.");
    }
    const uniqueIds = [...new Set(value.userIds.map((id) => id.trim()))];
    if (uniqueIds.length === 0) {
      throw new Error("선택 발송에는 한 명 이상의 사용자가 필요합니다.");
    }
    if (uniqueIds.length > MAX_PUSH_TARGETS) {
      throw new Error(
        `한 번에 최대 ${MAX_PUSH_TARGETS}명까지 발송할 수 있습니다.`,
      );
    }
    userIds = uniqueIds;
  }

  return {
    title,
    body,
    data,
    userIds,
    audience: getPushPreferenceAudience(data),
  };
}
