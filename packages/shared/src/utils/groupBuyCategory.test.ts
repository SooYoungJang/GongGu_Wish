import { describe, expect, it } from "vitest";

import { getGroupBuyCategoryLabel } from "./groupBuyCategory";

describe("group-buy category presentation", () => {
  it("returns Korean labels for current and legacy category values", () => {
    expect(getGroupBuyCategoryLabel("beauty")).toBe("뷰티");
    expect(getGroupBuyCategoryLabel("living")).toBe("생활용품");
    expect(getGroupBuyCategoryLabel("digital")).toBe("전자제품");
  });

  it("preserves unknown labels and omits empty values", () => {
    expect(getGroupBuyCategoryLabel("새 카테고리")).toBe("새 카테고리");
    expect(getGroupBuyCategoryLabel("  ")).toBeNull();
    expect(getGroupBuyCategoryLabel(null)).toBeNull();
  });
});
