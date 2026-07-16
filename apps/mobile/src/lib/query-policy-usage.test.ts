import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const queryConsumers = [
  "../features/ranking/usePopularGroupBuys.ts",
  "../features/ranking/useSellerRankings.ts",
  "../screens/AdminScreen.tsx",
  "../screens/CalendarScreen.tsx",
  "../screens/DetailScreen.tsx",
  "../screens/HomeScreen.tsx",
  "../screens/InfluencerGroupBuysScreen.tsx",
  "../screens/ReelsScreen.tsx",
  "../screens/SearchScreen.tsx",
] as const;

describe("mobile query policy usage", () => {
  it.each(queryConsumers)("%s inherits the shared freshness and retry policy", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");

    expect(source).not.toMatch(/\bretry:\s*false\b/);
    expect(source).not.toMatch(/\bstaleTime\s*:/);
  });
});
