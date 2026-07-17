import { describe, expect, it, vi } from "vitest";

vi.mock("../services/notifications", () => ({
  getLastNotificationResponseUrl: vi.fn().mockResolvedValue(null),
  subscribeNotificationResponseUrls: vi.fn(() => vi.fn()),
}));

import { createNotificationLinking } from "./notificationLinking";

describe("notification linking", () => {
  it("prefers an OS initial URL before a cold-start notification response", async () => {
    const linking = createNotificationLinking({
      getInitialLinkingUrl: vi
        .fn()
        .mockResolvedValue("gongguwish://group-buy/os-link"),
      getLastNotificationUrl: vi
        .fn()
        .mockResolvedValue("gongguwish://group-buy/push-link"),
      subscribeLinkingUrls: vi.fn(() => vi.fn()),
      subscribeNotificationUrls: vi.fn(() => vi.fn()),
    });

    await expect(linking.getInitialURL()).resolves.toBe(
      "gongguwish://group-buy/os-link",
    );
  });

  it("falls back to the last cold-start notification URL", async () => {
    const linking = createNotificationLinking({
      getInitialLinkingUrl: vi.fn().mockResolvedValue(null),
      getLastNotificationUrl: vi
        .fn()
        .mockResolvedValue("gongguwish://group-buy/push-link"),
      subscribeLinkingUrls: vi.fn(() => vi.fn()),
      subscribeNotificationUrls: vi.fn(() => vi.fn()),
    });

    await expect(linking.getInitialURL()).resolves.toBe(
      "gongguwish://group-buy/push-link",
    );
  });

  it("subscribes to live app links and notification taps and cleans up both", () => {
    const linkListeners: Array<(url: string) => void> = [];
    const notificationListeners: Array<(url: string) => void> = [];
    const removeLink = vi.fn();
    const removeNotification = vi.fn();
    const linking = createNotificationLinking({
      getInitialLinkingUrl: vi.fn().mockResolvedValue(null),
      getLastNotificationUrl: vi.fn().mockResolvedValue(null),
      subscribeLinkingUrls: (listener) => {
        linkListeners.push(listener);
        return removeLink;
      },
      subscribeNotificationUrls: (listener) => {
        notificationListeners.push(listener);
        return removeNotification;
      },
    });
    const listener = vi.fn();

    const unsubscribe = linking.subscribe(listener);
    linkListeners[0]?.("gongguwish://group-buy/link");
    notificationListeners[0]?.("gongguwish://group-buy/notification");
    expect(listener.mock.calls).toEqual([
      ["gongguwish://group-buy/link"],
      ["gongguwish://group-buy/notification"],
    ]);

    unsubscribe();
    expect(removeLink).toHaveBeenCalledOnce();
    expect(removeNotification).toHaveBeenCalledOnce();
  });
});
