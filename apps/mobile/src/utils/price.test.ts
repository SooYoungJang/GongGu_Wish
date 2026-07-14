import { describe, expect, it } from "vitest";

import { formatPriceKrw, normalizePriceKrw } from "./price";

describe("formatPriceKrw", () => {
  it("formats valid won amounts for product surfaces", () => {
    expect(formatPriceKrw(25900)).toBe("25,900원");
    expect(formatPriceKrw(0)).toBe("0원");
  });

  it("returns null for missing or invalid amounts", () => {
    expect(formatPriceKrw(null)).toBeNull();
    expect(formatPriceKrw(undefined)).toBeNull();
    expect(formatPriceKrw("25900")).toBeNull();
    expect(formatPriceKrw(1.5)).toBeNull();
  });
});

describe("normalizePriceKrw", () => {
  it("converts integer API strings without weakening the numeric contract", () => {
    expect(normalizePriceKrw("25,900")).toBe(25900);
    expect(normalizePriceKrw(0)).toBe(0);
    expect(normalizePriceKrw(null)).toBeNull();
    expect(normalizePriceKrw(undefined)).toBeUndefined();
  });

  it("rejects malformed or out-of-range API values", () => {
    expect(normalizePriceKrw("가격 미정")).toBeNull();
    expect(normalizePriceKrw(-1)).toBeNull();
    expect(normalizePriceKrw(2_147_483_648)).toBeNull();
  });
});
