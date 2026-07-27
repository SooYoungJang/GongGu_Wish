import { describe, expect, it } from "vitest";

import type { GroupBuy } from "../types";
import {
  normalizeReminderPreference,
  normalizeReminderUpdate,
  prunePastReminderDays,
} from "./groupBuyReminderPreference";

const GROUP_BUY = {
  id: "group-buy-1",
  productName: "테스트 공구",
  brandName: null,
  category: null,
  startDate: "2026-07-27T00:00:00.000Z",
  endDate: "2026-08-03T00:00:00.000Z",
  purchaseUrl: null,
  discountInfo: null,
  priceKrw: null,
  summary: null,
  confidence: 1,
  thumbnailUrl: null,
  videoUrl: null,
  mediaUrls: [],
  mediaType: null,
  rawPost: { postUrl: "", influencer: { instagramUsername: "" } },
} satisfies GroupBuy;

describe("group-buy reminder preferences", () => {
  it("migrates legacy reminder days to a deadline preference", () => {
    expect(normalizeReminderPreference(undefined, [7, 3, 3], [])).toEqual({
      type: "deadline",
      reminderDays: [3, 7],
      reminderTimeMinutes: null,
    });
    expect(normalizeReminderUpdate([6, 2, 2])).toEqual({
      type: "deadline",
      reminderDays: [2, 6],
      reminderTimeMinutes: null,
    });
  });

  it("fails closed on an invalid saved opening time", () => {
    expect(
      normalizeReminderPreference(
        {
          type: "opening",
          reminderDays: [7, 0, 0, 8],
          reminderTimeMinutes: -1,
        },
        [],
        [],
      ),
    ).toEqual({
      type: "opening",
      reminderDays: [],
      reminderTimeMinutes: 9 * 60,
    });
    expect(
      normalizeReminderPreference(
        {
          type: "opening",
          reminderDays: [7, 0, 0, 8],
          reminderTimeMinutes: 15 * 60 + 30,
        },
        [],
        [],
      ),
    ).toEqual({
      type: "opening",
      reminderDays: [0, 7],
      reminderTimeMinutes: 15 * 60 + 30,
    });
  });

  it("keeps only opening triggers that remain in the future", () => {
    expect(
      prunePastReminderDays(
        GROUP_BUY,
        {
          type: "opening",
          reminderDays: [0, 6, 7],
          reminderTimeMinutes: 15 * 60 + 30,
        },
        Date.parse("2026-07-20T06:30:00.000Z"),
      ),
    ).toEqual({
      type: "opening",
      reminderDays: [0, 6],
      reminderTimeMinutes: 15 * 60 + 30,
    });
  });
});
