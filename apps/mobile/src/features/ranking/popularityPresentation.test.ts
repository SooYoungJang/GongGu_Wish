import { describe, expect, it } from "vitest";

import {
  getRankingItemAccessibilityLabel,
  getTopPopularityScore,
  getPopularityIndex,
  getPopularityPresentation,
} from "./popularityPresentation";
import type { GroupBuyRankingMetrics } from "./types";

function metrics(
  overrides: Partial<GroupBuyRankingMetrics> = {},
): GroupBuyRankingMetrics {
  return {
    deepViews: 0,
    bookmarks: 0,
    notifications: 0,
    searchClicks: 0,
    score: 0,
    scoreDelta: 0,
    ...overrides,
  };
}

describe("popularity presentation", () => {
  it("normalizes each score against the current ranking leader", () => {
    expect(getPopularityIndex(96, 96)).toBe(100);
    expect(getPopularityIndex(48, 96)).toBe(50);
    expect(getPopularityIndex(24.4, 96)).toBe(25);
  });

  it("keeps malformed or out-of-range scores inside zero to one hundred", () => {
    expect(getPopularityIndex(120, 96)).toBe(100);
    expect(getPopularityIndex(-1, 96)).toBe(0);
    expect(getPopularityIndex(20, 0)).toBe(0);
    expect(getPopularityIndex(Number.NaN, 96)).toBe(0);
  });

  it("prioritizes a positive score change as a rising reason", () => {
    expect(
      getPopularityPresentation(
        metrics({
          deepViews: 1200,
          bookmarks: 30,
          score: 88,
          scoreDelta: 4,
        }),
        100,
      ),
    ).toEqual({ index: 88, reason: "인기점수 상승", tone: "rising" });
  });

  it("uses honest intent signals before the broad view signal", () => {
    expect(
      getPopularityPresentation(
        metrics({ deepViews: 5000, bookmarks: 18 }),
        100,
      ).reason,
    ).toBe("저장 반응 있음");
    expect(
      getPopularityPresentation(
        metrics({ deepViews: 5000, notifications: 12 }),
        100,
      ).reason,
    ).toBe("알림 관심 있음");
    expect(
      getPopularityPresentation(
        metrics({ deepViews: 5000, searchClicks: 24 }),
        100,
      ).reason,
    ).toBe("상세 관심 있음");
  });

  it("falls back to views and then an evidence-neutral pending reason", () => {
    expect(
      getPopularityPresentation(metrics({ deepViews: 5000 }), 100).reason,
    ).toBe("조회 반응 있음");
    expect(getPopularityPresentation(metrics(), 100).reason).toBe(
      "인기 신호 집계 중",
    );
  });

  it("ignores malformed scores when selecting the comparison leader", () => {
    expect(
      getTopPopularityScore([100, Number.NaN, 50, Number.POSITIVE_INFINITY]),
    ).toBe(100);
    expect(getTopPopularityScore([-10, 0, Number.NaN])).toBe(0);
  });

  it("builds one complete accessible label from the visible card facts", () => {
    expect(
      getRankingItemAccessibilityLabel({
        rank: 1,
        name: "여름 한정 공구",
        priceKrw: 200000,
        deadline: "7월 31일 마감",
        popularity: {
          index: 100,
          reason: "저장 반응 있음",
          tone: "saved",
        },
        metrics: metrics({
          deepViews: 12000,
          bookmarks: 83,
          notifications: 7,
        }),
      }),
    ).toBe(
      "1위 여름 한정 공구, 200,000원, 7월 31일 마감, 인기지수 100, 저장 반응 있음, 조회 1.2만, 저장 83, 알림 7, 상세 보기",
    );
  });
});
