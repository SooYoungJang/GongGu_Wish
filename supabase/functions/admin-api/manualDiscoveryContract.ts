import { automaticInstagramPostUrl } from "./automaticCollectionReviewContract.ts";

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/u;
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

export type ManualDiscoveryInput = {
  instagramPostId: string;
  postUrl: string;
  instagramUsername: string;
  caption: string;
  takenAt: string;
  imageUrl: string | null;
};

export class ManualDiscoveryContractError extends Error {}

export type ManualDiscoveryExistingOutcome =
  | { kind: "conflict" }
  | { kind: "duplicate"; rawPostId: string; groupBuyId: string }
  | { kind: "resume"; rawPostId: string };

export function manualDiscoveryPostUrlCandidates(postUrl: string) {
  const canonical = automaticInstagramPostUrl(postUrl);
  if (!canonical) return [];

  const url = new URL(canonical);
  const shortcode = url.pathname.split("/").filter(Boolean)[1];
  if (!shortcode) return [];

  const candidates = new Set<string>();
  for (const host of ["www.instagram.com", "instagram.com", "instagr.am"]) {
    for (const kind of ["p", "reel", "tv"]) {
      const path = `/${kind}/${shortcode}`;
      candidates.add(`https://${host}${path}`);
      candidates.add(`https://${host}${path}/`);
    }
  }
  return [...candidates];
}

export function manualDiscoveryExistingOutcome(
  sourceType: unknown,
  rawPostId: string,
  groupBuyId: string | null,
): ManualDiscoveryExistingOutcome {
  if (sourceType !== "MANUAL_DISCOVERY") return { kind: "conflict" };
  if (groupBuyId) {
    return { kind: "duplicate", rawPostId, groupBuyId };
  }
  return { kind: "resume", rawPostId };
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ManualDiscoveryContractError(`${label}을(를) 입력해주세요.`);
  }
  return value.trim();
}

function normalizePostUrl(value: unknown) {
  const validated = automaticInstagramPostUrl(value);
  if (!validated) {
    throw new ManualDiscoveryContractError(
      "공개 Instagram 게시물 URL을 입력해주세요.",
    );
  }
  const url = new URL(validated);
  const [kind, instagramPostId] = url.pathname.split("/").filter(Boolean);
  if (!kind || !instagramPostId) {
    throw new ManualDiscoveryContractError(
      "공개 Instagram 게시물 URL을 입력해주세요.",
    );
  }
  return {
    instagramPostId,
    postUrl: `https://www.instagram.com/${kind}/${instagramPostId}/`,
  };
}

function normalizeInstagramUsername(value: unknown) {
  const candidate = requiredText(value, "Instagram 계정명").replace(/^@/u, "");
  if (!USERNAME_RE.test(candidate)) {
    throw new ManualDiscoveryContractError(
      "Instagram 계정명이 올바르지 않습니다.",
    );
  }
  return candidate.toLowerCase();
}

function normalizeTakenAt(value: unknown) {
  const candidate = requiredText(value, "게시 시각");
  if (!ISO_TIMESTAMP_RE.test(candidate)) {
    throw new ManualDiscoveryContractError(
      "게시 시각은 시간대가 포함된 ISO 날짜여야 합니다.",
    );
  }
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw new ManualDiscoveryContractError("게시 시각이 올바르지 않습니다.");
  }
  return date.toISOString();
}

function normalizeImageUrl(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2_000) {
    throw new ManualDiscoveryContractError("이미지 URL이 올바르지 않습니다.");
  }
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      throw new Error("invalid");
    }
    return url.toString();
  } catch {
    throw new ManualDiscoveryContractError("이미지 URL은 HTTPS여야 합니다.");
  }
}

export function normalizeManualDiscoveryInput(
  body: Record<string, unknown>,
): ManualDiscoveryInput {
  const { instagramPostId, postUrl } = normalizePostUrl(body.postUrl);
  const caption = requiredText(body.caption, "캡션");
  if (caption.length > 20_000) {
    throw new ManualDiscoveryContractError("캡션은 20,000자 이하여야 합니다.");
  }

  return {
    instagramPostId,
    postUrl,
    instagramUsername: normalizeInstagramUsername(body.instagramUsername),
    caption,
    takenAt: normalizeTakenAt(body.takenAt),
    imageUrl: normalizeImageUrl(body.imageUrl),
  };
}
