import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAd } from "react-native-google-mobile-ads";

import { AdsContext } from "../../ads/AdsContext";
import { NativeAdCard } from "./NativeAdCard";

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
  homeNativeUnitId: "home-native-unit",
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
});

describe("NativeAdCard", () => {
  it("does not request an ad when the integration is disabled", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AdsContext.Provider
          value={{ enabled: false, isReady: false, homeNativeUnitId: null }}
        >
          <NativeAdCard />
        </AdsContext.Provider>,
      );
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  });

  it("labels and renders a loaded native ad, then destroys it on unmount", async () => {
    const destroy = vi.fn();
    const ad = {
      advertiser: "공구 파트너",
      body: "이번 주 추천 상품을 확인해 보세요.",
      callToAction: "자세히 보기",
      destroy,
      headline: "취향에 맞춘 추천",
    } as unknown as Awaited<
      ReturnType<typeof NativeAd.createForAdRequest>
    >;
    vi.mocked(NativeAd.createForAdRequest).mockResolvedValue(ad);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard testID="home-native-ad" />
        </AdsContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(NativeAd.createForAdRequest).toHaveBeenCalledWith(
      "home-native-unit",
    );
    expect(flattenText(renderer!.toJSON())).toContain("광고");
    expect(flattenText(renderer!.toJSON())).toContain("취향에 맞춘 추천");
    const adView = renderer!.root
      .findAllByProps({ testID: "home-native-ad" })
      .find((node) => typeof node.props.accessibilityLabel === "string");
    expect(adView?.props.accessibilityLabel).toContain("광고");

    act(() => renderer!.unmount());
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("leaves no blank card when loading fails", async () => {
    vi.mocked(NativeAd.createForAdRequest).mockRejectedValue(
      new Error("no fill"),
    );

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard />
        </AdsContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  it("destroys an ad that finishes loading after unmount", async () => {
    const destroy = vi.fn();
    const ad = { destroy } as unknown as Awaited<
      ReturnType<typeof NativeAd.createForAdRequest>
    >;
    vi.mocked(NativeAd.createForAdRequest).mockResolvedValue(ad);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AdsContext.Provider value={enabledAds}>
          <NativeAdCard />
        </AdsContext.Provider>,
      );
    });
    expect(NativeAd.createForAdRequest).toHaveBeenCalledOnce();
    act(() => renderer!.unmount());

    await act(async () => {
      await Promise.resolve();
    });

    expect(destroy).toHaveBeenCalledOnce();
  });
});
