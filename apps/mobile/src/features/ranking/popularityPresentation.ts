import {
  formatCompactCount,
  type GroupBuyRankingMetrics,
} from "./types";
import { formatEndDate } from "../../utils";
import { formatPriceKrw } from "../../utils/price";

export type PopularityTone =
  | "rising"
  | "saved"
  | "alerted"
  | "explored"
  | "viewed"
  | "neutral";

export type PopularityPresentation = {
  index: number;
  reason: string;
  tone: PopularityTone;
};

export function getPopularityIndex(score: number, topScore: number): number {
  if (
    !Number.isFinite(score) ||
    !Number.isFinite(topScore) ||
    score <= 0 ||
    topScore <= 0
  ) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((score / topScore) * 100)));
}

export function getTopPopularityScore(scores: readonly number[]): number {
  return scores.reduce(
    (highest, score) =>
      Number.isFinite(score) && score > highest ? score : highest,
    0,
  );
}

function getPopularityReason(
  metrics: GroupBuyRankingMetrics,
): Omit<PopularityPresentation, "index"> {
  if (Number.isFinite(metrics.scoreDelta) && metrics.scoreDelta > 0) {
    return { reason: "인기점수 상승", tone: "rising" };
  }

  if (metrics.bookmarks > 0) {
    return { reason: "저장 반응 있음", tone: "saved" };
  }

  if (metrics.notifications > 0) {
    return { reason: "알림 관심 있음", tone: "alerted" };
  }

  if (metrics.searchClicks > 0) {
    return { reason: "상세 관심 있음", tone: "explored" };
  }

  if (metrics.deepViews > 0) {
    return { reason: "조회 반응 있음", tone: "viewed" };
  }

  return { reason: "인기 신호 집계 중", tone: "neutral" };
}

export function getPopularityPresentation(
  metrics: GroupBuyRankingMetrics,
  topScore: number,
): PopularityPresentation {
  return {
    index: getPopularityIndex(metrics.score, topScore),
    ...getPopularityReason(metrics),
  };
}

export function formatRankingDeadline(endDate: string | null): string {
  const label = formatEndDate(endDate);
  return label === "미정" ? "마감일 미정" : label;
}

export function getRankingItemAccessibilityLabel({
  rank,
  name,
  priceKrw,
  deadline,
  popularity,
  metrics,
}: {
  rank: number;
  name: string;
  priceKrw: unknown;
  deadline: string;
  popularity: PopularityPresentation;
  metrics?: GroupBuyRankingMetrics;
}): string {
  const price = formatPriceKrw(priceKrw) ?? "가격 정보 없음";
  const metricLabel = metrics
    ? `, 조회 ${formatCompactCount(metrics.deepViews)}, 저장 ${formatCompactCount(metrics.bookmarks)}, 알림 ${formatCompactCount(metrics.notifications)}`
    : "";

  return `${rank}위 ${name}, ${price}, ${deadline}, 인기지수 ${popularity.index}, ${popularity.reason}${metricLabel}, 상세 보기`;
}
