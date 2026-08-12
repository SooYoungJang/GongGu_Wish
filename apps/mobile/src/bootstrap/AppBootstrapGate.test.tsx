import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapMocks = vi.hoisted(() => ({
  authLoading: false,
  hideAsync: vi.fn(() => Promise.resolve()),
  prefetch: vi.fn(),
  queryClient: { id: "mobile-query-client" },
}));

vi.mock("expo-splash-screen", () => ({
  hideAsync: bootstrapMocks.hideAsync,
}));

vi.mock("expo-image", () => ({
  Image: "ExpoImage",
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => bootstrapMocks.queryClient,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isLoading: bootstrapMocks.authLoading }),
}));

import { AppBootstrapGate } from "./AppBootstrapGate";

describe("AppBootstrapGate", () => {
  beforeEach(() => {
    bootstrapMocks.authLoading = false;
    bootstrapMocks.hideAsync.mockClear();
    bootstrapMocks.prefetch.mockReset();
  });

  it("replaces the native splash with full-screen artwork while bootstrap completes", async () => {
    let resolvePrefetch!: () => void;
    bootstrapMocks.prefetch.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePrefetch = resolve;
      }),
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AppBootstrapGate prefetch={bootstrapMocks.prefetch}>
          <span>app</span>
        </AppBootstrapGate>,
      );
    });

    expect(
      renderer.root.findByProps({ testID: "warm-commerce-splash" }),
    ).toBeDefined();
    expect(bootstrapMocks.prefetch).toHaveBeenCalledWith(
      bootstrapMocks.queryClient,
    );
    expect(bootstrapMocks.hideAsync).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root
        .findByProps({ testID: "warm-commerce-splash-artwork" })
        .props.onDisplay();
    });

    expect(bootstrapMocks.hideAsync).toHaveBeenCalledOnce();
    expect(
      renderer.root.findByProps({ testID: "warm-commerce-splash" }),
    ).toBeDefined();

    await act(async () => {
      resolvePrefetch();
    });

    expect(renderer.toJSON()).toEqual({
      type: "span",
      props: {},
      children: ["app"],
    });
  });

  it("releases the app after the timeout when the network never settles", async () => {
    vi.useFakeTimers();
    bootstrapMocks.prefetch.mockReturnValue(new Promise<void>(() => {}));
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AppBootstrapGate prefetch={bootstrapMocks.prefetch} timeoutMs={100}>
          <span>app</span>
        </AppBootstrapGate>,
      );
    });

    await act(async () => {
      renderer.root
        .findByProps({ testID: "warm-commerce-splash-artwork" })
        .props.onDisplay();
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(renderer.toJSON()).not.toBeNull();
    expect(bootstrapMocks.hideAsync).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
