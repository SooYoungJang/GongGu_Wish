import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const focusMock = vi.hoisted(() => ({ current: true }));
const appStateMock = vi.hoisted(() => ({
  currentState: "active" as string | null,
  listeners: new Map<string, ReturnType<typeof vi.fn>>(),
  removals: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => focusMock.current,
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appStateMock.currentState;
    },
    addEventListener: vi.fn(
      (event: string, listener: ReturnType<typeof vi.fn>) => {
        appStateMock.listeners.set(event, listener);
        const remove = vi.fn(() => appStateMock.listeners.delete(event));
        appStateMock.removals.push(remove);
        return { remove };
      },
    ),
  },
  Platform: { OS: "android" },
}));

import { usePlaybackLifecycle } from "./usePlaybackLifecycle";

function LifecycleHarness() {
  const lifecycle = usePlaybackLifecycle();
  return React.createElement("Lifecycle", lifecycle);
}

describe("usePlaybackLifecycle", () => {
  beforeEach(() => {
    focusMock.current = true;
    appStateMock.currentState = "active";
    appStateMock.listeners.clear();
    appStateMock.removals = [];
  });

  it("requires navigator focus, active AppState, and Android interaction focus", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<LifecycleHarness />);
    });
    const read = () =>
      renderer!.root.find((node) => String(node.type) === "Lifecycle").props;

    expect(read()).toMatchObject({
      isScreenFocused: true,
      isAppActive: true,
      isAppFocused: true,
      isPlaybackActive: true,
    });

    act(() => appStateMock.listeners.get("blur")?.());
    expect(read().isPlaybackActive).toBe(false);

    act(() => appStateMock.listeners.get("focus")?.());
    expect(read().isPlaybackActive).toBe(true);

    act(() => {
      appStateMock.currentState = "background";
      appStateMock.listeners.get("change")?.("background");
    });
    expect(read()).toMatchObject({
      isAppActive: false,
      isAppFocused: false,
      isPlaybackActive: false,
    });

    act(() => {
      appStateMock.currentState = "active";
      appStateMock.listeners.get("change")?.("active");
    });
    expect(read().isPlaybackActive).toBe(true);

    focusMock.current = false;
    act(() => renderer!.update(<LifecycleHarness />));
    expect(read()).toMatchObject({
      isScreenFocused: false,
      isPlaybackActive: false,
    });

    act(() => renderer!.unmount());
    expect(appStateMock.removals).toHaveLength(3);
    expect(
      appStateMock.removals.every((remove) => remove.mock.calls.length === 1),
    ).toBe(true);
  });
});
