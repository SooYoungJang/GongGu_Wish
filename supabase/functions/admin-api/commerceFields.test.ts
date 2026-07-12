import {
  mergeHomeBannerSchedule,
  normalizeHomeBannerBoolean,
  normalizeHomeBannerDate,
  normalizePriceKrw,
  validateHomeBannerSchedule,
} from "./commerceFields.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function assertThrows(callback: () => unknown, message?: string) {
  try {
    callback();
  } catch (error) {
    if (message && (!(error instanceof Error) || !error.message.includes(message))) {
      throw new Error(`Expected error containing ${JSON.stringify(message)}.`);
    }
    return;
  }
  throw new Error("Expected callback to throw.");
}

Deno.test("requires an explicit boolean home-banner flag", () => {
  assertEquals(normalizeHomeBannerBoolean(true), true);
  assertEquals(normalizeHomeBannerBoolean(false), false);

  for (const value of ["true", "false", 0, 1, null, undefined]) {
    assertThrows(
      () => normalizeHomeBannerBoolean(value),
      "isHomeBanner must be a boolean.",
    );
  }
});

Deno.test("normalizes optional KRW prices", () => {
  assertEquals(normalizePriceKrw("39,000"), 39000);
  assertEquals(normalizePriceKrw(0), 0);
  assertEquals(normalizePriceKrw(""), null);
  assertEquals(normalizePriceKrw(null), null);
});

Deno.test("rejects invalid KRW prices", () => {
  for (const value of [-1, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER + 1, "가격 미정"]) {
    assertThrows(() => normalizePriceKrw(value));
  }
});

Deno.test("accepts the largest PostgreSQL INTEGER price", () => {
  assertEquals(normalizePriceKrw(2_147_483_647), 2_147_483_647);
});

Deno.test("normalizes strict date-only banner values", () => {
  assertEquals(
    normalizeHomeBannerDate("2026-07-12", "homeBannerStartDate"),
    "2026-07-12",
  );
  assertEquals(normalizeHomeBannerDate("", "homeBannerStartDate"), null);

  for (const value of ["2026-02-30", "2026/07/12", 20260712]) {
    assertThrows(() => normalizeHomeBannerDate(value, "homeBannerStartDate"));
  }
});

Deno.test("requires an inclusive valid range when home banner is enabled", () => {
  validateHomeBannerSchedule({
    isHomeBanner: true,
    startDate: "2026-07-12",
    endDate: "2026-07-12",
  });

  for (const schedule of [
    { isHomeBanner: true, startDate: null, endDate: "2026-07-12" },
    { isHomeBanner: true, startDate: "2026-07-12", endDate: null },
    { isHomeBanner: true, startDate: "2026-07-13", endDate: "2026-07-12" },
  ]) {
    assertThrows(() => validateHomeBannerSchedule(schedule));
  }
});

Deno.test("merges a partial banner patch with the existing schedule before validation", () => {
  assertEquals(
    mergeHomeBannerSchedule(
      { endDate: "2026-07-20" },
      { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
    ),
    {
      isHomeBanner: true,
      startDate: "2026-07-12",
      endDate: "2026-07-20",
    },
  );

  assertThrows(() => mergeHomeBannerSchedule(
    { startDate: "2026-07-21" },
    { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
  ));
});
