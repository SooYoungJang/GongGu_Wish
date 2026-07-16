import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAccessibilityAutoPlayPause } from "./useAccessibilityAutoPlayPause";

// eslint-disable-next-line no-unused-vars
type BooleanChangeListener = (enabled: boolean) => void;
const listeners: Record<string, BooleanChangeListener> = {};
const addEventListenerMock =
  AccessibilityInfo.addEventListener as unknown as ReturnType<typeof vi.fn>;

function renderPreference() {
  let paused = false;

  function Harness() {
    paused = useAccessibilityAutoPlayPause();
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });

  return {
    get paused() {
      return paused;
    },
    renderer: renderer!,
  };
}

describe("useAccessibilityAutoPlayPause", () => {
  beforeEach(() => {
    for (const event of Object.keys(listeners)) delete listeners[event];
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReset()
      .mockResolvedValue(false);
    vi.mocked(AccessibilityInfo.isScreenReaderEnabled)
      .mockReset()
      .mockResolvedValue(false);
    addEventListenerMock
      .mockReset()
      .mockImplementation(
        (event: string, listener: BooleanChangeListener) => {
          listeners[event] = listener;
          return { remove: vi.fn() };
        },
      );
  });

  it("keeps autoplay paused until accessibility preferences resolve", () => {
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
      new Promise<boolean>(() => {}),
    );
    vi.mocked(AccessibilityInfo.isScreenReaderEnabled).mockReturnValue(
      new Promise<boolean>(() => {}),
    );

    const preference = renderPreference();

    expect(preference.paused).toBe(true);
    preference.renderer.unmount();
  });

  it("pauses when reduce motion is enabled", async () => {
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);

    const preference = renderPreference();
    await act(async () => {
      await Promise.resolve();
    });

    expect(preference.paused).toBe(true);
    preference.renderer.unmount();
  });

  it("reacts to screen reader changes after autoplay is enabled", async () => {
    const preference = renderPreference();
    await act(async () => {
      await Promise.resolve();
    });
    expect(preference.paused).toBe(false);

    act(() => {
      listeners.screenReaderChanged(true);
    });
    expect(preference.paused).toBe(true);
    preference.renderer.unmount();
  });
});
