import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
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
  });

  it("shows a neutral first-run age-band choice and enters age-13 browse mode", async () => {
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
      renderer.root.findByProps({ testID: "age-selection-screen" }),
    ).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ testID: "app-content" }),
    ).toHaveLength(0);

    await act(async () => {
      renderer.root.findByProps({ testID: "age-option-age13" }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "@gonggu/audience/age-band/v1",
      "age13",
    );
    expect(renderer.root.findByProps({ testID: "app-content" })).toBeTruthy();
  });

  it("blocks under-13 users and lets them correct the selection", async () => {
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

    expect(
      renderer.root.findByProps({ testID: "under13-blocked-screen" }),
    ).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ testID: "app-content" }),
    ).toHaveLength(0);

    await act(async () => {
      renderer.root
        .findByProps({ testID: "change-age-selection" })
        .props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storage.removeItem).toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ testID: "age-selection-screen" }),
    ).toBeTruthy();
  });
});
