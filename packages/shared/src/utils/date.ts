export function formatDate(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return "미정";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "날짜 오류";
  try {
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      ...options,
    });
  } catch {
    return "날짜 오류";
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "미정";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "날짜 오류";
  try {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "종료됨";
    if (diffDays === 0) return "오늘 마감";
    if (diffDays === 1) return "내일 마감";
    if (diffDays <= 7) return `${diffDays}일 남음`;
    return formatDate(dateString);
  } catch {
    return "날짜 오류";
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "미정";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "날짜 오류";
  try {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "날짜 오류";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function normalizeInstagramUsername(username: string): string {
  return username.trim().replace(/^@/, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-status-pending-bg text-status-pending-text border-status-pending-border",
    REVIEW_REQUIRED: "bg-status-review-bg text-status-review-text border-status-review-border",
    APPROVED: "bg-status-approved-bg text-status-approved-text border-status-approved-border",
    REJECTED: "bg-status-rejected-bg text-status-rejected-text border-status-rejected-border",
    DUPLICATE: "bg-status-duplicate-bg text-status-duplicate-text border-status-duplicate-border",
    EXPIRED: "bg-status-duplicate-bg text-status-duplicate-text border-status-duplicate-border",
  };
  return colors[status] || "bg-status-duplicate-bg text-status-duplicate-text border-status-duplicate-border";
}