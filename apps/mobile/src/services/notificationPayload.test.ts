import { describe, expect, it } from "vitest";

import {
  buildGroupBuyNotificationUrl,
  notificationDataToUrl,
  parseGroupBuyNotificationUrl,
} from "./notificationPayload";

describe("notification payload", () => {
  it("round-trips a bounded canonical group-buy URL", () => {
    const url = buildGroupBuyNotificationUrl(" group-buy-1 ");
    expect(url).toBe("gongguwish-staging://group-buy/group-buy-1");
    expect(parseGroupBuyNotificationUrl(url)).toBe("group-buy-1");
  });

  it("uses a valid URL or falls back to groupBuyId", () => {
    expect(
      notificationDataToUrl({
        url: "gongguwish-staging://group-buy/deal%20one",
        groupBuyId: "ignored",
      }),
    ).toBe("gongguwish-staging://group-buy/deal%20one");
    expect(notificationDataToUrl({ groupBuyId: "deal-two" })).toBe(
      "gongguwish-staging://group-buy/deal-two",
    );
  });

  it("rejects external schemes, wrong hosts, nested paths, and malformed data", () => {
    expect(
      parseGroupBuyNotificationUrl("https://evil.example/group-buy/1"),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl("gongguwish-staging://settings/group-buy-1"),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl("gongguwish-staging://group-buy/a/b"),
    ).toBeNull();
    expect(notificationDataToUrl({ url: "https://evil.example" })).toBeNull();
    expect(notificationDataToUrl({ groupBuyId: "a/b" })).toBeNull();
    expect(notificationDataToUrl(null)).toBeNull();
  });

  it("isolates Staging notification URLs from the Production scheme", () => {
    expect(
      parseGroupBuyNotificationUrl("gongguwish://group-buy/production-only"),
    ).toBeNull();
  });
});
