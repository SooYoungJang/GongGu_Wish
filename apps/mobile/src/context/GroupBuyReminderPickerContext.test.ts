import { describe, expect, it } from "vitest";

import {
  getAvailableReminderDays,
  getInitialOpeningReminderDays,
  getInitialReminderDays,
  getReminderPickerMode,
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
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("restores only still-available saved days", () => {
    expect(
      getInitialReminderDays(
        endDate,
        [1, 2, 3, 4, 5, 6, 7],
        Date.parse("2026-07-20T00:00:00.000Z"),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("uses opening reminders only while a valid start date is in the future", () => {
    const now = Date.parse("2026-07-20T00:00:00.000Z");

    expect(getReminderPickerMode("2026-07-20T00:00:00.001Z", now)).toBe(
      "opening",
    );
    expect(getReminderPickerMode("2026-07-20T00:00:00.000Z", now)).toBe(
      "deadline",
    );
    expect(getReminderPickerMode("invalid", now)).toBe("deadline");
    expect(getReminderPickerMode(null, now)).toBe("deadline");
  });

  it("restores D-day opening reminders using the selected common time", () => {
    expect(
      getInitialOpeningReminderDays(
        "2026-07-27T00:00:00.000Z",
        [0, 6, 7],
        15 * 60 + 30,
        Date.parse("2026-07-20T06:30:00.000Z"),
      ),
    ).toEqual([0, 6]);
  });
});
