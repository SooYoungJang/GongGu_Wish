import { describe, expect, it } from "vitest";
import {
  getGroupBuyVisibility,
  groupBuyStatusForVisibility,
  shouldReturnToGroupBuyList,
} from "./groupBuyVisibility";

describe("group-buy visibility", () => {
  it("enables only the action that changes the current visibility", () => {
    expect(getGroupBuyVisibility("APPROVED")).toEqual({
      isHidden: false,
      canHide: true,
      canShow: false,
    });
    expect(getGroupBuyVisibility("REJECTED")).toEqual({
      isHidden: true,
      canHide: false,
      canShow: true,
    });
  });

  it("maps visibility changes to the statuses supported by the admin API", () => {
    expect(groupBuyStatusForVisibility(true)).toBe("REJECTED");
    expect(groupBuyStatusForVisibility(false)).toBe("APPROVED");
  });

  it("returns to the list when a status change leaves the active filter", () => {
    expect(shouldReturnToGroupBuyList("APPROVED", "REJECTED")).toBe(true);
    expect(shouldReturnToGroupBuyList("ALL", "REJECTED")).toBe(false);
    expect(shouldReturnToGroupBuyList("APPROVED", "APPROVED")).toBe(false);
  });
});
