import { describe, expect, it } from "vitest";

import {
  getAvailableReminderDays,
  getInitialReminderDays,
} from "./groupBuyReminderPicker";

describe("group-buy reminder picker", () => {
  const endDate = "2026-07-27T00:00:00.000Z";

  it("starts with no implicit selection for a new item", () => {
    expect(
      getInitialReminderDays(
        endDate,
        [],
        Date.parse("2026-07-19T23:59:59.000Z"),
      ),
    ).toEqual([]);
  });

  it("disables reminder times that are already past", () => {
    expect(
      getAvailableReminderDays(endDate, Date.parse("2026-07-20T00:00:00.000Z")),
    ).toEqual([1, 3]);
  });

  it("restores only still-available saved days", () => {
    expect(
      getInitialReminderDays(
        endDate,
        [1, 3, 7],
        Date.parse("2026-07-20T00:00:00.000Z"),
      ),
    ).toEqual([1, 3]);
  });
});
