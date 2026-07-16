import { describe, expect, it } from "vitest";

import { getTabBarVisibilityStyle } from "./tabBarVisibility";

describe("getTabBarVisibilityStyle", () => {
  it("removes a hidden tab bar from layout and the accessibility tree", () => {
    expect(getTabBarVisibilityStyle(true)).toEqual({ display: "none" });
    expect(getTabBarVisibilityStyle(false)).toEqual({ display: "flex" });
  });
});
