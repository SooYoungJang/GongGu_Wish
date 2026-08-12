import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
const nativeSplash = vi.hoisted(() => ({
  hideAsync: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
vi.mock("expo-splash-screen", () => ({
  hideAsync: nativeSplash.hideAsync,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));

import { AudienceProvider } from "./AudienceContext";
import { AudienceGate } from "./AudienceGate";

describe("AudienceGate", () => {
  beforeEach(() => {
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    storage.removeItem.mockReset().mockResolvedValue(undefined);
    nativeSplash.hideAsync.mockReset().mockResolvedValue(undefined);
  });

  it("releases the native splash when the first-run age screen is ready", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AudienceProvider>
          <AudienceGate>
            <Text testID="app-content">공개 콘텐츠</Text>
          </AudienceGate>
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const ageScreen = renderer.root.findByProps({
      testID: "age-selection-screen",
    });
    expect(nativeSplash.hideAsync).not.toHaveBeenCalled();

    await act(async () => {
      ageScreen.props.onLayout();
      ageScreen.props.onLayout();
      await Promise.resolve();
    });

    expect(nativeSplash.hideAsync).toHaveBeenCalledOnce();
  });

  it("asks for an age band on first run before opening public content", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AudienceProvider>
          <AudienceGate>
            <Text testID="app-content">공개 콘텐츠</Text>
          </AudienceGate>
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      renderer.root.findAllByProps({ testID: "app-content" }),
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ testID: "age-selection-screen" }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "만 14세 이상입니다" }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "만 14세 미만입니다" }),
    ).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();

    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: "만 14세 이상입니다" })
        .props.onPress();
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "@gonggu/audience/age-band/v1",
      "age14Plus",
    );
    expect(renderer.root.findByProps({ testID: "app-content" })).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ testID: "age-selection-screen" }),
    ).toHaveLength(0);
  });

  it("keeps under-14 users in restricted public browse mode", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AudienceProvider>
          <AudienceGate>
            <Text testID="app-content">공개 콘텐츠</Text>
          </AudienceGate>
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const restrictedButton = renderer.root.findByProps({
      accessibilityLabel: "만 14세 미만입니다",
    });
    expect(restrictedButton.props.accessibilityRole).toBe("button");

    await act(async () => {
      await restrictedButton.props.onPress();
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "@gonggu/audience/age-band/v1",
      "age13",
    );
    expect(renderer.root.findByProps({ testID: "app-content" })).toBeTruthy();
  });

  it("keeps the age choice visible when persistence fails", async () => {
    storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AudienceProvider>
          <AudienceGate>
            <Text testID="app-content">공개 콘텐츠</Text>
          </AudienceGate>
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: "만 14세 이상입니다" })
        .props.onPress();
    });

    expect(
      renderer.root.findByProps({ testID: "age-selection-screen" }),
    ).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "연령 설정을 저장하지 못했어요",
    );
  });

  it("keeps legacy under-13 selections in restricted public browse mode", async () => {
    storage.getItem.mockResolvedValueOnce("under13");
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AudienceProvider>
          <AudienceGate>
            <Text testID="app-content">공개 콘텐츠</Text>
          </AudienceGate>
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: "app-content" })).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ testID: "under13-blocked-screen" }),
    ).toHaveLength(0);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
