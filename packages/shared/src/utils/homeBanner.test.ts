import { describe, expect, it } from "vitest";
import {
  getHomeBannerDateKey,
  isHomeBannerEligible,
  selectHomeBannerItems,
} from "./homeBanner";

type TestItem = {
  id: string;
  isHomeBanner?: boolean;
  homeBannerStartDate?: string | null;
  homeBannerEndDate?: string | null;
};

function makeItem(overrides: Partial<TestItem> = {}): TestItem {
  return {
    id: "banner-1",
    isHomeBanner: true,
    homeBannerStartDate: "2026-07-02",
    homeBannerEndDate: "2026-07-04",
    ...overrides,
  };
}

describe("home banner eligibility", () => {
  it("uses inclusive local calendar dates", () => {
    const item = makeItem();

    expect(isHomeBannerEligible(item, new Date(2026, 6, 2, 0, 30))).toBe(true);
    expect(isHomeBannerEligible(item, new Date(2026, 6, 4, 23, 59))).toBe(true);
    expect(isHomeBannerEligible(item, new Date(2026, 6, 5))).toBe(false);
  });

  it("requires explicit opt-in and a valid active range", () => {
    expect(
      isHomeBannerEligible(
        makeItem({ isHomeBanner: false }),
        new Date(2026, 6, 3),
      ),
    ).toBe(false);
    expect(
      isHomeBannerEligible(
        makeItem({
          homeBannerStartDate: "2026-07-04",
          homeBannerEndDate: "2026-07-02",
        }),
        new Date(2026, 6, 3),
      ),
    ).toBe(false);
    expect(
      isHomeBannerEligible(
        makeItem({ homeBannerStartDate: "2026-2-02" }),
        new Date(2026, 1, 2),
      ),
    ).toBe(false);
  });

  it("selects only eligible items while preserving order", () => {
    const items = [
      makeItem({ id: "disabled", isHomeBanner: false }),
      makeItem({ id: "active" }),
      makeItem({ id: "future", homeBannerStartDate: "2026-07-05" }),
    ];

    expect(
      selectHomeBannerItems(items, new Date(2026, 6, 3)).map((item) => item.id),
    ).toEqual(["active"]);
  });

  it("formats the local date used by the server-side query", () => {
    expect(getHomeBannerDateKey(new Date(2026, 6, 3, 23, 59))).toBe(
      "2026-07-03",
    );
  });
});
