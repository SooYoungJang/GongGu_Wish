import { describe, expect, it } from "vitest";

import {
  buildGroupBuyShareUrl,
  buildGroupBuyNotificationUrl,
  notificationDataToUrl,
  parseGroupBuyNotificationUrl,
  resolveShareUrlOrigin,
} from "./notificationPayload";

describe("notification payload", () => {
  it("maps each app scheme to its isolated HTTPS App Link origin", () => {
    expect(resolveShareUrlOrigin("gongguwish-preview:")).toBe(
      "https://api-preview.gongguwish.com",
    );
    expect(resolveShareUrlOrigin("gongguwish:")).toBe(
      "https://gongguwish.com",
    );
    expect(() => resolveShareUrlOrigin("unknown:")).toThrow(/app scheme/i);
  });

  it("builds a tappable Preview HTTPS app link", () => {
    expect(buildGroupBuyShareUrl(" group-buy-1 ")).toBe(
      "https://api-preview.gongguwish.com/group-buy/group-buy-1",
    );
    expect(
      parseGroupBuyNotificationUrl(buildGroupBuyShareUrl("group-buy-1")),
    ).toBe("group-buy-1");
    expect(buildGroupBuyShareUrl("a/b")).toBeNull();
  });

  it("parses only the current environment HTTPS app-link host", () => {
    expect(
      parseGroupBuyNotificationUrl(
        "https://api-preview.gongguwish.com/group-buy/deal%20one",
      ),
    ).toBe("deal one");
    expect(
      parseGroupBuyNotificationUrl(
        "https://gongguwish.com/group-buy/production-only",
      ),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl(
        "https://api-preview.gongguwish.com/group-buy/a/b",
      ),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl(
        "https://user@api-preview.gongguwish.com/group-buy/deal-one",
      ),
    ).toBeNull();
  });

  it("round-trips a bounded canonical group-buy URL", () => {
    const url = buildGroupBuyNotificationUrl(" group-buy-1 ");
    expect(url).toBe("gongguwish-preview://group-buy/group-buy-1");
    expect(parseGroupBuyNotificationUrl(url)).toBe("group-buy-1");
  });

  it("uses a valid URL or falls back to groupBuyId", () => {
    expect(
      notificationDataToUrl({
        url: "gongguwish-preview://group-buy/deal%20one",
        groupBuyId: "ignored",
      }),
    ).toBe("gongguwish-preview://group-buy/deal%20one");
    expect(notificationDataToUrl({ groupBuyId: "deal-two" })).toBe(
      "gongguwish-preview://group-buy/deal-two",
    );
  });

  it("rejects external schemes, wrong hosts, nested paths, and malformed data", () => {
    expect(
      parseGroupBuyNotificationUrl("https://evil.example/group-buy/1"),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl("gongguwish-preview://settings/group-buy-1"),
    ).toBeNull();
    expect(
      parseGroupBuyNotificationUrl("gongguwish-preview://group-buy/a/b"),
    ).toBeNull();
    expect(notificationDataToUrl({ url: "https://evil.example" })).toBeNull();
    expect(notificationDataToUrl({ groupBuyId: "a/b" })).toBeNull();
    expect(notificationDataToUrl(null)).toBeNull();
  });

  it("isolates Preview notification URLs from the Production scheme", () => {
    expect(
      parseGroupBuyNotificationUrl("gongguwish://group-buy/production-only"),
    ).toBeNull();
  });
});
