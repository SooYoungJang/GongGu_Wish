import {
  mergeHomeBannerSchedule,
  normalizeHomeBannerBoolean,
  normalizeHomeBannerDate,
  normalizeCommercePatch,
  normalizePriceKrw,
  normalizePricePatch,
  normalizePersistedPriceKrw,
  validateHomeBannerSchedule,
} from "./commerceFields.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

function assertThrows(callback: () => unknown, message?: string) {
  try {
    callback();
  } catch (error) {
    if (
      message &&
      (!(error instanceof Error) || !error.message.includes(message))
    ) {
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

Deno.test("fails closed when a persisted price field is missing", () => {
  assertEquals(normalizePersistedPriceKrw(null), null);
  assertEquals(normalizePersistedPriceKrw(200000), 200000);
  assertEquals(normalizePersistedPriceKrw("200000"), 200000);
  assertThrows(
    () => normalizePersistedPriceKrw(undefined),
    "price_krw is missing from the database response.",
  );
});

Deno.test(
  "accepts both admin and database price field names for a patch",
  () => {
    assertEquals(normalizePricePatch({ priceKrw: "39,000" }), {
      price_krw: 39000,
    });
    assertEquals(normalizePricePatch({ price_krw: 25900 }), {
      price_krw: 25900,
    });
    assertEquals(normalizePricePatch({ summary: "unchanged" }), {});
  },
);

Deno.test(
  "persists the admin price and explicit home-banner opt-out together",
  () => {
    assertEquals(
      normalizeCommercePatch(
        {
          priceKrw: "200,000",
          isHomeBanner: false,
          homeBannerStartDate: "",
          homeBannerEndDate: "",
        },
        {
          is_home_banner: true,
          home_banner_start_date: "2026-07-01",
          home_banner_end_date: "2026-07-31",
        },
      ),
      {
        price_krw: 200000,
        is_home_banner: false,
        home_banner_start_date: null,
        home_banner_end_date: null,
      },
    );
  },
);

Deno.test("clears persisted banner dates when only the opt-out flag changes", () => {
  assertEquals(
    normalizeCommercePatch(
      { isHomeBanner: false },
      {
        is_home_banner: true,
        home_banner_start_date: "2026-07-01",
        home_banner_end_date: "2026-07-31",
      },
    ),
    {
      is_home_banner: false,
      home_banner_start_date: null,
      home_banner_end_date: null,
    },
  );
});

Deno.test("rejects invalid KRW prices", () => {
  for (const value of [
    -1,
    1.5,
    2_147_483_648,
    Number.MAX_SAFE_INTEGER + 1,
    "가격 미정",
  ]) {
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

Deno.test(
  "requires an inclusive valid range when home banner is enabled",
  () => {
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
  },
);

Deno.test(
  "merges a partial banner patch with the existing schedule before validation",
  () => {
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

    assertThrows(() =>
      mergeHomeBannerSchedule(
        { startDate: "2026-07-21" },
        { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
      ),
    );
  },
);

Deno.test("canonicalizes a merged opt-out schedule before persistence", () => {
  assertEquals(
    mergeHomeBannerSchedule(
      { isHomeBanner: false },
      { isHomeBanner: true, startDate: "2026-07-12", endDate: "2026-07-19" },
    ),
    { isHomeBanner: false, startDate: null, endDate: null },
  );
});
