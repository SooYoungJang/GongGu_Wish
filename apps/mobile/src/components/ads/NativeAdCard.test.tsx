import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAd } from "react-native-google-mobile-ads";

import { AdsContext } from "../../ads/AdsContext.android";
import { NativeAdCard } from "./NativeAdCard.android";

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    isDark: false,
    themeMode: "system",
    setThemeMode: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

const enabledAds = {
  enabled: true,
  isReady: true,
  isSettled: true,
  homeNativeUnitId: "home-native-unit",
  privacyOptionsRequired: false,
  showPrivacyOptions: vi.fn(async () => false),
};

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join(" ") ?? ""
  );
}

beforeEach(() => {
  vi.mocked(NativeAd.createForAdRequest).mockReset();
  vi.useRealTimers();
});

describe("NativeAdCard", () => {
  it("does not request an ad when the integration is disabled", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AdsContext.Provider
          value={{
            enabled: false,
            isReady: false,
            isSettled: true,
            homeNativeUnitId: null,
            privacyOptionsRequired: false,
            showPrivacyOptions: vi.fn(async () => false),
          }}
        >
          <NativeAdCard />
        </AdsContext.Provider>,
      );
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  });

  it("keeps the placement loading while consent initialization is unsettled", () => {
    const onLoadStateChange = vi.fn();
    act(() => {
      TestRenderer.create(
        <AdsContext.Provider
          value={{ ...enabledAds, isReady: false, isSettled: false }}
        >
          <NativeAdCard onLoadStateChange={onLoadStateChange} />
        </AdsContext.Provider>,
      );
    });

    expect(onLoadStateChange).toHaveBeenLastCalledWith("loading");
    expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  });

  it("labels and renders a loaded native ad, then destroys it on unmount", async () => {
    const onLoadStateChange = vi.fn();
    const destroy = vi.fn();
    const ad = {
      advertiser: "공구 파트너",
      body: "이번 주 추천 상품을 확인해 보세요.",
      callToAction: "자세히 보기",
      destroy,
      headline: "취향에 맞춘 추천",
      icon: { scale: 1, url: "https://example.com/icon.png" },
      mediaContent: {
        aspectRatio: 16 / 9,
        duration: 0,
        hasVideoContent: false,
      },
    } as unknown as Awaited<ReturnType<typeof NativeAd.createForAdRequest>>;
    vi.mocked(NativeAd.createForAdRequest).mockResolvedValue(ad);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard
            onLoadStateChange={onLoadStateChange}
            testID="home-native-ad"
          />
        </AdsContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(NativeAd.createForAdRequest).toHaveBeenCalledWith(
      "home-native-unit",
      expect.objectContaining({ aspectRatio: expect.any(Number) }),
    );
    expect(onLoadStateChange).toHaveBeenLastCalledWith("loaded");
    expect(flattenText(renderer!.toJSON())).toContain("광고");
    expect(flattenText(renderer!.toJSON())).toContain("취향에 맞춘 추천");
    expect(
      renderer!.root.findByType("Image" as unknown as React.ElementType).props
        .source,
    ).toEqual({ uri: "https://example.com/icon.png" });
    expect(
      renderer!.root.findAllByType(
        "NativeMediaView" as unknown as React.ElementType,
      ),
    ).toHaveLength(1);

    act(() => renderer!.unmount());
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("leaves no blank card when loading fails", async () => {
    const onLoadStateChange = vi.fn();
    vi.mocked(NativeAd.createForAdRequest).mockRejectedValue(
      new Error("no fill"),
    );

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard onLoadStateChange={onLoadStateChange} />
        </AdsContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(onLoadStateChange).toHaveBeenLastCalledWith("unavailable");
  });

  it("omits optional icon, media, body, advertiser, and empty CTA assets", async () => {
    const ad = {
      advertiser: null,
      body: "",
      callToAction: "",
      destroy: vi.fn(),
      headline: "소재가 적은 광고",
      icon: null,
      mediaContent: null,
    } as unknown as Awaited<ReturnType<typeof NativeAd.createForAdRequest>>;
    vi.mocked(NativeAd.createForAdRequest).mockResolvedValue(ad);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard />
        </AdsContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(flattenText(renderer!.toJSON())).toContain("소재가 적은 광고");
    expect(
      renderer!.root.findAllByType(
        "NativeMediaView" as unknown as React.ElementType,
      ),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByType("Image" as unknown as React.ElementType),
    ).toHaveLength(0);
    expect(flattenText(renderer!.toJSON())).not.toContain("자세히 보기");
  });

  it("times out without inserting a late ad under visible content", async () => {
    vi.useFakeTimers();
    const onLoadStateChange = vi.fn();
    let resolveAd!: React.Dispatch<
      Awaited<ReturnType<typeof NativeAd.createForAdRequest>>
    >;
    const pendingAd = new Promise<
      Awaited<ReturnType<typeof NativeAd.createForAdRequest>>
    >((resolve) => {
      resolveAd = resolve;
    });
    vi.mocked(NativeAd.createForAdRequest).mockReturnValue(pendingAd);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard onLoadStateChange={onLoadStateChange} />
        </AdsContext.Provider>,
      );
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onLoadStateChange).toHaveBeenLastCalledWith("unavailable");

    const destroy = vi.fn();
    await act(async () => {
      resolveAd({ destroy } as unknown as Awaited<
        ReturnType<typeof NativeAd.createForAdRequest>
      >);
      await Promise.resolve();
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("destroys an ad that finishes loading after unmount", async () => {
    const destroy = vi.fn();
    const ad = { destroy } as unknown as Awaited<
      ReturnType<typeof NativeAd.createForAdRequest>
    >;
    let resolveAd!: React.Dispatch<
      Awaited<ReturnType<typeof NativeAd.createForAdRequest>>
    >;
    const pendingAd = new Promise<
      Awaited<ReturnType<typeof NativeAd.createForAdRequest>>
    >((resolve) => {
      resolveAd = resolve;
    });
    vi.mocked(NativeAd.createForAdRequest).mockReturnValue(pendingAd);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard />
        </AdsContext.Provider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(NativeAd.createForAdRequest).toHaveBeenCalledOnce();
    act(() => renderer!.unmount());

    await act(async () => {
      resolveAd(ad);
      await Promise.resolve();
    });

    expect(destroy).toHaveBeenCalledOnce();
  });
});
