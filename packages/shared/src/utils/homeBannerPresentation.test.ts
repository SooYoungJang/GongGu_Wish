import { describe, expect, it } from "vitest";
import { getHomeBannerStatusCopy } from "./homeBannerPresentation";

describe("getHomeBannerStatusCopy", () => {
  it("uses the explicit sale price and a valid discount percent", () => {
    expect(
      getHomeBannerStatusCopy(
        {
          priceKrw: 179000,
          discountInfo: "정가 229,000원 / 공구가 179,000원 · 22% 할인",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        },
        new Date("2026-07-15T12:00:00"),
      ),
    ).toMatchObject({
      accentLabel: "22%",
      detailLabel: "179,000원",
      priceKrw: 179000,
      pricePlacement: "detail",
    });
  });

  it("does not treat a material composition percentage as a discount", () => {
    expect(
      getHomeBannerStatusCopy(
        {
          discountInfo: "100% 천연 원료 · 공구가 39,000원",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        },
        new Date("2026-07-15T12:00:00"),
      ),
    ).toMatchObject({
      accentLabel: "공구 진행 중",
      detailLabel: "39,000원",
      priceKrw: 39000,
    });
  });

  it("excludes a trailing delivery fee from the product price", () => {
    expect(
      getHomeBannerStatusCopy(
        {
          discountInfo: "179,000원 + 배송비 3,000원",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        },
        new Date("2026-07-15T12:00:00"),
      ).priceKrw,
    ).toBe(179000);
  });
});
