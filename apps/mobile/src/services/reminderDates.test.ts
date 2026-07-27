import { describe, expect, it } from "vitest";

import {
  buildGroupBuyOpeningReminderDates,
  buildGroupBuyOpeningReminderOptions,
  buildGroupBuyReminderDates,
  buildGroupBuyReminderOptions,
  NOTIFICATION_REMINDER_DAYS,
  OPENING_REMINDER_DAYS,
} from "./reminderDates";

describe("group-buy reminder dates", () => {
  const endDate = "2026-07-27T00:00:00.000Z";

  it("offers every deadline offset from D-7 through D-1", () => {
    expect(NOTIFICATION_REMINDER_DAYS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      buildGroupBuyReminderOptions(endDate, {
        now: Date.parse("2026-07-19T23:59:59.000Z"),
      }).map(({ reminderDay, triggerDate, available }) => ({
        reminderDay,
        triggerDate: triggerDate.toISOString(),
        available,
      })),
    ).toEqual([
      {
        reminderDay: 1,
        triggerDate: "2026-07-26T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 2,
        triggerDate: "2026-07-25T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 3,
        triggerDate: "2026-07-24T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 4,
        triggerDate: "2026-07-23T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 5,
        triggerDate: "2026-07-22T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 6,
        triggerDate: "2026-07-21T00:00:00.000Z",
        available: true,
      },
      {
        reminderDay: 7,
        triggerDate: "2026-07-20T00:00:00.000Z",
        available: true,
      },
    ]);
  });

  it("schedules arbitrary selected days while rejecting out-of-range values", () => {
    expect(
      buildGroupBuyReminderDates(endDate, [2, 4, 6, 6, 0, 8], {
        now: Date.parse("2026-07-19T23:59:59.000Z"),
      }).map(({ reminderDay }) => reminderDay),
    ).toEqual([6, 4, 2]);
  });

  it("marks a trigger unavailable as soon as its 09:00 KST time passes", () => {
    const options = buildGroupBuyReminderOptions(endDate, {
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(
      options.find(({ reminderDay }) => reminderDay === 7)?.available,
    ).toBe(false);
    expect(
      options.find(({ reminderDay }) => reminderDay === 6)?.available,
    ).toBe(true);
  });

  it("offers D-day through D-7 at the selected KST opening time", () => {
    const startDate = "2026-07-27T00:00:00.000Z";

    expect(OPENING_REMINDER_DAYS).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(
      buildGroupBuyOpeningReminderOptions(startDate, 15 * 60 + 30, {
        now: Date.parse("2026-07-19T23:59:59.000Z"),
      }).map(({ reminderDay, triggerDate, available }) => ({
        reminderDay,
        triggerDate: triggerDate.toISOString(),
        available,
      })),
    ).toEqual([
      {
        reminderDay: 0,
        triggerDate: "2026-07-27T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 1,
        triggerDate: "2026-07-26T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 2,
        triggerDate: "2026-07-25T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 3,
        triggerDate: "2026-07-24T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 4,
        triggerDate: "2026-07-23T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 5,
        triggerDate: "2026-07-22T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 6,
        triggerDate: "2026-07-21T06:30:00.000Z",
        available: true,
      },
      {
        reminderDay: 7,
        triggerDate: "2026-07-20T06:30:00.000Z",
        available: true,
      },
    ]);
  });

  it("filters opening selections whose chosen time has already passed", () => {
    const startDate = "2026-07-27T00:00:00.000Z";

    expect(
      buildGroupBuyOpeningReminderDates(startDate, [0, 6, 7], 15 * 60 + 30, {
        now: Date.parse("2026-07-20T06:30:00.000Z"),
      }).map(({ reminderDay }) => reminderDay),
    ).toEqual([6, 0]);
    expect(
      buildGroupBuyOpeningReminderOptions(startDate, -1, {
        now: Date.parse("2026-07-19T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });
});
