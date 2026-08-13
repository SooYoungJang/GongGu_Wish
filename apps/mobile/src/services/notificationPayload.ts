import { AUTH_REDIRECT_URL } from "../lib/auth-config";

const NOTIFICATION_URL_PROTOCOL = new URL(AUTH_REDIRECT_URL).protocol;
export const NOTIFICATION_URL_PREFIX = `${NOTIFICATION_URL_PROTOCOL}//`;
const SHARE_URL_ORIGINS = {
  "gongguwish-preview:": "https://api-preview.gongguwish.com",
  "gongguwish:": "https://gongguwish.com",
} as const;

export function resolveShareUrlOrigin(protocol: string) {
  const origin = SHARE_URL_ORIGINS[protocol as keyof typeof SHARE_URL_ORIGINS];
  if (!origin) throw new Error("Unsupported app scheme for share links");
  return origin;
}

export const SHARE_URL_ORIGIN = resolveShareUrlOrigin(
  NOTIFICATION_URL_PROTOCOL,
);
export const SHARE_URL_PREFIX = `${SHARE_URL_ORIGIN}/`;

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

function buildGroupBuyPath(groupBuyId: string) {
  const normalized = normalizeGroupBuyId(groupBuyId);
  return normalized ? `group-buy/${encodeURIComponent(normalized)}` : null;
}

export function buildGroupBuyNotificationUrl(groupBuyId: string) {
  const path = buildGroupBuyPath(groupBuyId);
  return path ? `${NOTIFICATION_URL_PREFIX}${path}` : null;
}

export function buildGroupBuyShareUrl(groupBuyId: string) {
  const path = buildGroupBuyPath(groupBuyId);
  return path ? `${SHARE_URL_PREFIX}${path}` : null;
}

export function parseGroupBuyNotificationUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.port) return null;
    const isCustomScheme =
      parsed.protocol === NOTIFICATION_URL_PROTOCOL &&
      parsed.hostname === "group-buy";
    const shareOrigin = new URL(SHARE_URL_ORIGIN);
    const isHttpsAppLink =
      parsed.origin === shareOrigin.origin &&
      parsed.pathname.startsWith("/group-buy/");
    if ((!isCustomScheme && !isHttpsAppLink) || parsed.search || parsed.hash) {
      return null;
    }
    const encodedId = isCustomScheme
      ? parsed.pathname.replace(/^\//, "")
      : parsed.pathname.slice("/group-buy/".length);
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
