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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && EXPO_PUSH_TOKEN_PATTERN.test(value);
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
    if (serialized.length > MAX_PUSH_DATA_BYTES) {
      throw new Error(
        `푸시 데이터는 ${MAX_PUSH_DATA_BYTES}자 이하로 입력해주세요.`,
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
    if (uniqueIds.length > MAX_PUSH_TARGETS) {
      throw new Error(
        `한 번에 최대 ${MAX_PUSH_TARGETS}명까지 발송할 수 있습니다.`,
      );
    }
    userIds = uniqueIds.length > 0 ? uniqueIds : null;
  }

  return { title, body, data, userIds };
}
