import { describe, expect, it } from "vitest";

import { colors } from "../index";

describe("shared root token exports", () => {
  it("re-exports colors from the root shared package entrypoint", () => {
    expect(colors.primary[500]).toBe("oklch(0.58 0.22 260)");
  });

  it("exposes additive Home redesign tokens without changing primary/accent", () => {
    expect(colors.cta.purple).toBe("oklch(0.58 0.24 300)");
    expect(Object.keys(colors.categoryPastel)).toEqual([
      "beauty",
      "fashion",
      "food",
      "lifestyle",
      "baby",
      "digital",
    ]);
    expect(colors.cardOverlayGradient.bottom).toBe("oklch(0 0 0 / 0.62)");
  });
});
