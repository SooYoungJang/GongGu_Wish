import { describe, expect, it } from "vitest";
import {
  getGroupBuyListStatus,
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

  it("keeps an approved group buy visible through its inclusive end date", () => {
    expect(
      getGroupBuyListStatus(
        "APPROVED",
        "2026-08-22",
        new Date("2026-08-22T12:00:00+09:00"),
      ),
    ).toEqual({ status: "APPROVED", label: "노출중" });
  });

  it("marks an approved group buy whose end date has passed", () => {
    expect(
      getGroupBuyListStatus(
        "APPROVED",
        "2026-08-21",
        new Date("2026-08-22T12:00:00+09:00"),
      ),
    ).toEqual({ status: "EXPIRED", label: "노출 기간 만료" });
  });

  it("does not replace non-approved statuses with a date-derived status", () => {
    expect(
      getGroupBuyListStatus(
        "REVIEW_REQUIRED",
        "2026-08-21",
        new Date("2026-08-22T12:00:00+09:00"),
      ),
    ).toEqual({ status: "REVIEW_REQUIRED" });
  });
});
