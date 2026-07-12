import { describe, expect, it } from "vitest";
import { MAX_PRICE_KRW, parsePriceKrwInput } from "./priceKrw";

describe("parsePriceKrwInput", () => {
  it("normalizes optional comma-formatted KRW values", () => {
    expect(parsePriceKrwInput("39,000")).toBe(39000);
    expect(parsePriceKrwInput("")).toBeNull();
  });

  it("accepts the PostgreSQL INTEGER maximum", () => {
    expect(parsePriceKrwInput(String(MAX_PRICE_KRW))).toBe(MAX_PRICE_KRW);
  });

  it("rejects invalid or database-incompatible values", () => {
    for (const value of ["-1", "1.5", "가격 미정", String(MAX_PRICE_KRW + 1)]) {
      expect(() => parsePriceKrwInput(value)).toThrow();
    }
  });
});
