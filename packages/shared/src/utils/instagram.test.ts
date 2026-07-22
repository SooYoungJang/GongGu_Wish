import { describe, expect, it } from "vitest";

import {
  formatInstagramHandle,
  normalizeOptionalInstagramUsername,
} from "./instagram";

describe("Instagram username presentation", () => {
  it("normalizes whitespace and a leading at-sign", () => {
    expect(normalizeOptionalInstagramUsername("  @beauty_pick  ")).toBe(
      "beauty_pick",
    );
    expect(formatInstagramHandle("  @beauty_pick  ")).toBe("@beauty_pick");
  });

  it("does not expose empty or legacy unknown placeholders", () => {
    expect(normalizeOptionalInstagramUsername("")).toBeNull();
    expect(normalizeOptionalInstagramUsername("UNKNOWN")).toBeNull();
    expect(formatInstagramHandle(null)).toBeNull();
  });
});
