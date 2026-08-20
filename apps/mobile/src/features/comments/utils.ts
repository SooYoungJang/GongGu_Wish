export const COMMENT_TERMS_VERSION = "community-v1";
export const MAX_COMMENT_LENGTH = 500;

export function normalizeCommentBody(value: string): string {
  return value.trim();
}

export function validateCommentBody(value: string): string | null {
  const body = normalizeCommentBody(value);
  if (!body) return "댓글 내용을 입력해 주세요.";
  if (body.length > MAX_COMMENT_LENGTH) {
    return `댓글은 ${MAX_COMMENT_LENGTH}자 이내로 작성해 주세요.`;
  }
  if (/[<>]/.test(body) || /(https?:\/\/|www\.)/i.test(body)) {
    return "HTML과 외부 링크는 댓글에 포함할 수 없어요.";
  }
  return null;
}

export function visualCommentIndent(depth: number): number {
  return Math.min(Math.max(depth, 0), 3) * 16;
}

export function formatCommentAge(createdAt: string, now = Date.now()): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "방금 전";

  const elapsedMs = Math.max(0, now - created);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < minute) return "방금 전";
  if (elapsedMs < hour) return `${Math.floor(elapsedMs / minute)}분 전`;
  if (elapsedMs < day) return `${Math.floor(elapsedMs / hour)}시간 전`;
  if (elapsedMs < month) return `${Math.floor(elapsedMs / day)}일 전`;
  if (elapsedMs < year) return `${Math.floor(elapsedMs / month)}개월 전`;
  return `${Math.floor(elapsedMs / year)}년 전`;
}

export function commentPlaceholder(state: string): string {
  if (state === "hidden") return "운영팀에 의해 숨겨진 댓글입니다.";
  return "삭제된 댓글입니다.";
}

export function createClientRequestId(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoObject?.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
