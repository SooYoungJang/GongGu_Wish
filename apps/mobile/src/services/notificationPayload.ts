function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafeGroupBuyIdCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (
      character === "/" ||
      character === "\\" ||
      codePoint <= 0x1f ||
      codePoint === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

function normalizeGroupBuyId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 128 ||
    hasUnsafeGroupBuyIdCharacter(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function buildGroupBuyNotificationUrl(groupBuyId: string) {
  const normalized = normalizeGroupBuyId(groupBuyId);
  return normalized
    ? `gongguwish://group-buy/${encodeURIComponent(normalized)}`
    : null;
}

export function parseGroupBuyNotificationUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "gongguwish:" ||
      parsed.hostname !== "group-buy" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    const encodedId = parsed.pathname.replace(/^\//, "");
    if (!encodedId || encodedId.includes("/")) return null;
    return normalizeGroupBuyId(decodeURIComponent(encodedId));
  } catch {
    return null;
  }
}

export function notificationDataToUrl(value: unknown) {
  if (!isRecord(value)) return null;
  const urlGroupBuyId = parseGroupBuyNotificationUrl(value.url);
  if (urlGroupBuyId) return buildGroupBuyNotificationUrl(urlGroupBuyId);
  return typeof value.groupBuyId === "string"
    ? buildGroupBuyNotificationUrl(value.groupBuyId)
    : null;
}

export function notificationResponseToUrl(value: unknown) {
  if (!isRecord(value)) return null;
  const notification = isRecord(value.notification) ? value.notification : null;
  const request = isRecord(notification?.request) ? notification.request : null;
  const content = isRecord(request?.content) ? request.content : null;
  return notificationDataToUrl(content?.data);
}
