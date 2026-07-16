import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const focusMock = vi.hoisted(() => ({
  effect: null as null | (() => void | (() => void)),
}));
const backHandlerMock = vi.hoisted(() => ({
  handler: null as null | (() => boolean),
  remove: vi.fn(),
  addEventListener: vi.fn((_event: string, handler: () => boolean) => {
    backHandlerMock.handler = handler;
    return { remove: backHandlerMock.remove };
  }),
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusMock.effect = effect;
  },
}));

vi.mock("react-native", () => ({
  BackHandler: {
    addEventListener: backHandlerMock.addEventListener,
  },
  Platform: { OS: "android" },
}));

import {
  decideMainTabsBack,
  useFocusedAndroidBackHandler,
} from "./androidBack";

function BackHandlerHarness({
  enabled = true,
  onBack,
}: {
  enabled?: boolean;
  onBack: () => boolean;
}) {
  useFocusedAndroidBackHandler(onBack, enabled);
  return null;
}

describe("decideMainTabsBack", () => {
  it("returns to Home from a non-Home tab before considering app exit", () => {
    expect(decideMainTabsBack("Search", 900, 1_000, 2_000)).toEqual({
      action: "navigate-home",
      nextHomeBackPressAt: 0,
    });
  });

  it("shows an exit hint first and exits only on a second Home press", () => {
    expect(decideMainTabsBack("Home", 0, 1_000, 2_000)).toEqual({
      action: "show-exit-hint",
      nextHomeBackPressAt: 1_000,
    });
    expect(decideMainTabsBack("Home", 1_000, 2_500, 2_000)).toEqual({
      action: "exit-app",
      nextHomeBackPressAt: 1_000,
    });
    expect(decideMainTabsBack("Home", 1_000, 3_001, 2_000)).toEqual({
      action: "show-exit-hint",
      nextHomeBackPressAt: 3_001,
    });
  });
});

describe("useFocusedAndroidBackHandler", () => {
  beforeEach(() => {
    focusMock.effect = null;
    backHandlerMock.handler = null;
    backHandlerMock.remove.mockClear();
    backHandlerMock.addEventListener.mockClear();
  });

  it("registers only while focused and removes the native listener on blur", () => {
    const onBack = vi.fn(() => true);
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<BackHandlerHarness onBack={onBack} />);
    });
    expect(backHandlerMock.addEventListener).not.toHaveBeenCalled();

    let blur: void | (() => void);
    act(() => {
      blur = focusMock.effect?.();
    });
    expect(backHandlerMock.addEventListener).toHaveBeenCalledTimes(1);
    expect(backHandlerMock.handler?.()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);

    act(() => {
      blur?.();
      renderer!.unmount();
    });
    expect(backHandlerMock.remove).toHaveBeenCalledTimes(1);
  });

  it("skips native registration when the current page is not eligible", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <BackHandlerHarness enabled={false} onBack={() => true} />,
      );
    });

    act(() => {
      focusMock.effect?.();
      renderer!.unmount();
    });
    expect(backHandlerMock.addEventListener).not.toHaveBeenCalled();
  });

  it("invokes the latest callback without re-registering while focused", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <BackHandlerHarness onBack={() => false} />,
      );
    });
    act(() => {
      focusMock.effect?.();
    });

    act(() => {
      renderer!.update(<BackHandlerHarness onBack={() => true} />);
    });

    expect(backHandlerMock.handler?.()).toBe(true);
    expect(backHandlerMock.addEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      renderer!.unmount();
    });
  });
});
