import { describe, expect, it } from "vitest";

import { parseSubmissionCaption } from "./captionParser";

describe("parseSubmissionCaption", () => {
  it("extracts Korean group-buy fields and a KRW price", () => {
    const parsed = parseSubmissionCaption(
      [
        "국내 배송 공구",
        "정가 29,000원",
        "마감 8/20",
        "https://shop.example/item",
      ].join("\n"),
      { referenceDate: new Date("2026-08-08T00:00:00Z") },
    );

    expect(parsed).toMatchObject({
      productName: "국내 배송 공구",
      endDate: "2026-08-20",
      purchaseUrl: "https://shop.example/item",
      priceKrw: 29000,
    });
  });

  it("does not invent missing review fields", () => {
    expect(parseSubmissionCaption("공구 소식만 있습니다")).toMatchObject({
      productName: "공구 소식만 있습니다",
    });
    expect(
      parseSubmissionCaption("공구 소식만 있습니다").purchaseUrl,
    ).toBeUndefined();
  });
});
