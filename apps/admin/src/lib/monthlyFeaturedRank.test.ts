import { describe, expect, it } from "vitest";
import {
  monthlyFeaturedRankInputValue,
  normalizeMonthlyFeaturedRankInput,
  parseMonthlyFeaturedRank,
} from "./monthlyFeaturedRank";

describe("monthly featured rank", () => {
  it("accepts a blank value or a positive integer", () => {
    expect(normalizeMonthlyFeaturedRankInput("")).toBe("");
    expect(normalizeMonthlyFeaturedRankInput("1")).toBe("1");
    expect(parseMonthlyFeaturedRank("12")).toBe(12);
  });

  it("rejects zero, negative, fractional, and non-numeric values", () => {
    for (const value of ["0", "-1", "1.5", "abc"]) {
      expect(normalizeMonthlyFeaturedRankInput(value)).toBeNull();
      expect(parseMonthlyFeaturedRank(value)).toBeNull();
    }
  });

  it("clears invalid stored values instead of showing them as editable ranks", () => {
    expect(monthlyFeaturedRankInputValue(null)).toBe("");
    expect(monthlyFeaturedRankInputValue(-1)).toBe("");
    expect(monthlyFeaturedRankInputValue(3)).toBe("3");
  });
});
