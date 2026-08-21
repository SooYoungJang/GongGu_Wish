import { describe, expect, it } from "vitest";

import { isSameProduct, normalizeProductPart } from "./productHistory";

describe("product history matching", () => {
  it("normalizes whitespace, punctuation, and casing for product matching", () => {
    expect(normalizeProductPart("  Dr.G / 크림  ")).toBe("drg크림");
    expect(normalizeProductPart("ＤＲ．Ｇ 크림")).toBe("drg크림");
  });

  it("matches the same product even when saved text formatting differs", () => {
    expect(
      isSameProduct(
        { brandName: "브랜드 A", productName: "진정 크림 50ml" },
        { brandName: " 브랜드A ", productName: "진정크림 50ML" },
      ),
    ).toBe(true);
  });

  it("does not match different products or different brands", () => {
    expect(
      isSameProduct(
        { brandName: "브랜드 A", productName: "진정 크림" },
        { brandName: "브랜드 B", productName: "진정 크림" },
      ),
    ).toBe(false);
    expect(
      isSameProduct(
        { brandName: "브랜드 A", productName: "진정 크림" },
        { brandName: "브랜드 A", productName: "수분 크림" },
      ),
    ).toBe(false);
  });

  it("falls back to product name when one side has no brand data", () => {
    expect(
      isSameProduct(
        { brandName: null, productName: "진정 크림" },
        { brandName: "브랜드 A", productName: "진정크림" },
      ),
    ).toBe(true);
  });
});
