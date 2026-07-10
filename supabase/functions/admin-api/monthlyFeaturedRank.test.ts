import { normalizeMonthlyFeaturedRank } from "./monthlyFeaturedRank.ts";

Deno.test("normalizes positive monthly featured ranks", () => {
  if (normalizeMonthlyFeaturedRank("3") !== 3) {
    throw new Error("positive integer rank should be accepted");
  }
  if (normalizeMonthlyFeaturedRank(null) !== null) {
    throw new Error("null should clear the rank");
  }
});

Deno.test("rejects non-positive or non-integer monthly featured ranks", () => {
  for (const value of [0, -1, 1.5, "abc"]) {
    let rejected = false;
    try {
      normalizeMonthlyFeaturedRank(value);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`invalid rank was accepted: ${String(value)}`);
    }
  }
});
