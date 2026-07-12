import {
  mergeHomeBannerSchedule,
  normalizeHomeBannerBoolean,
  normalizeHomeBannerDate,
  normalizePriceKrw,
  validateHomeBannerSchedule,
} from "./commerceFields.ts";
import { describe, expect, it } from "vitest";

describe("commerce field normalization", () => {
  it("requires an explicit boolean home-banner flag", () => {
    expect(normalizeHomeBannerBoolean(true)).toBe(true);
    expect(normalizeHomeBannerBoolean(false)).toBe(false);

    for (const value of ["true", "false", 0, 1, null, undefined]) {
      expect(() => normalizeHomeBannerBoolean(value)).toThrow(
        "isHomeBanner must be a boolean.",
      );
    }
  });

  it("normalizes optional KRW prices", () => {
    expect(normalizePriceKrw("39,000")).toBe(39000);
    expect(normalizePriceKrw(0)).toBe(0);
    expect(normalizePriceKrw("")).toBeNull();
    expect(normalizePriceKrw(null)).toBeNull();
  });

  it("rejects invalid KRW prices", () => {
    for (const value of [-1, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER + 1, "가격 미정"]) {
      expect(() => normalizePriceKrw(value)).toThrow();
    }
  });

  it("accepts the largest PostgreSQL INTEGER price", () => {
    expect(normalizePriceKrw(2_147_483_647)).toBe(2_147_483_647);
  });

  it("normalizes strict date-only banner values", () => {
    expect(normalizeHomeBannerDate("2026-07-12", "homeBannerStartDate")).toBe("2026-07-12");
    expect(normalizeHomeBannerDate("", "homeBannerStartDate")).toBeNull();

    for (const value of ["2026-02-30", "2026/07/12", 20260712]) {
      expect(() => normalizeHomeBannerDate(value, "homeBannerStartDate")).toThrow();
    }
  });

  it("requires an inclusive valid range when home banner is enabled", () => {
    expect(() => validateHomeBannerSchedule({
      isHomeBanner: true,
      startDate: "2026-07-12",
      endDate: "2026-07-12",
    })).not.toThrow();

    for (const schedule of [
      { isHomeBanner: true, startDate: null, endDate: "2026-07-12" },
      { isHomeBanner: true, startDate: "2026-07-12", endDate: null },
      { isHomeBanner: true, startDate: "2026-07-13", endDate: "2026-07-12" },
    ]) {
      expect(() => validateHomeBannerSchedule(schedule)).toThrow();
    }
  });

  it("merges a partial banner patch with the existing schedule before validation", () => {
    expect(mergeHomeBannerSchedule(
      { endDate: "2026-07-20" },
      { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
    )).toEqual({
      isHomeBanner: true,
      startDate: "2026-07-12",
      endDate: "2026-07-20",
    });

    expect(() => mergeHomeBannerSchedule(
      { startDate: "2026-07-21" },
      { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
    )).toThrow();
  });
});
