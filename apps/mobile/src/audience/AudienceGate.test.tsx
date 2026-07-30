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

  it("opens public content on first run without asking for an age band", async () => {
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
      renderer.root.findAllByProps({ testID: "age-selection-screen" }),
    ).toHaveLength(0);
    expect(storage.setItem).not.toHaveBeenCalled();
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
