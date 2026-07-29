import React from "react";
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

import {
  AGE_BAND_STORAGE_KEY,
  AudienceProvider,
  useAudience,
  type AudienceContextValue,
} from "./AudienceContext";

describe("AudienceProvider", () => {
  let current: AudienceContextValue | null = null;

  function Probe() {
    current = useAudience();
    return null;
  }

  beforeEach(() => {
    current = null;
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    storage.removeItem.mockReset().mockResolvedValue(undefined);
  });

  it("hydrates a valid locally stored age band without collecting a birth date", async () => {
    storage.getItem.mockResolvedValueOnce("age13");

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storage.getItem).toHaveBeenCalledWith(AGE_BAND_STORAGE_KEY);
    expect(current?.isHydrated).toBe(true);
    expect(current?.ageBand).toBe("age13");
    expect(current?.policy.canUseApp).toBe(true);
    expect(current?.policy.canAuthenticate).toBe(false);
  });

  it("fails closed when stored data is invalid", async () => {
    storage.getItem.mockResolvedValueOnce("2001-01-01");

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.isHydrated).toBe(true);
    expect(current?.ageBand).toBeNull();
    expect(current?.policy.resolved).toBe(false);
    expect(current?.policy.canRequestAds).toBe(false);
  });

  it("persists only the selected age band", async () => {
    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await current?.selectAgeBand("age14Plus");
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      AGE_BAND_STORAGE_KEY,
      "age14Plus",
    );
    expect(current?.ageBand).toBe("age14Plus");
  });

  it("runs registered cleanup when an unrestricted user selects age 13", async () => {
    storage.getItem.mockResolvedValueOnce("age14Plus");
    const cleanup = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      current?.registerRestrictedModeCleanup(cleanup);
    });
    await act(async () => {
      await current?.selectAgeBand("age13");
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(current?.policy.canAuthenticate).toBe(false);
    expect(current?.policy.canRequestAds).toBe(false);
  });

  it("removes the old unrestricted value before persisting a restricted selection", async () => {
    storage.getItem.mockResolvedValueOnce("age14Plus");
    storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await current?.selectAgeBand("age13");
    });

    expect(storage.removeItem).toHaveBeenCalledWith(AGE_BAND_STORAGE_KEY);
    expect(current?.policy.canAuthenticate).toBe(false);
  });

  it("does not run restricted cleanup during the initial age selection", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      current?.registerRestrictedModeCleanup(cleanup);
    });
    await act(async () => {
      await current?.selectAgeBand("age13");
    });

    expect(cleanup).not.toHaveBeenCalled();
  });

  it("keeps the latest selection when persistence calls overlap", async () => {
    storage.getItem.mockResolvedValueOnce("age13");
    let releaseFirstWrite!: () => void;
    let persistedValue: string | null = "age13";
    storage.setItem
      .mockImplementationOnce(
        async (_key: string, value: string) =>
          new Promise<void>((resolve) => {
            releaseFirstWrite = () => {
              persistedValue = value;
              resolve();
            };
          }),
      )
      .mockImplementation(async (_key: string, value: string) => {
        persistedValue = value;
      });

    await act(async () => {
      TestRenderer.create(
        <AudienceProvider>
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    let firstSelection!: Promise<void>;
    act(() => {
      firstSelection = current!.selectAgeBand("age14Plus");
    });
    await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalledTimes(1));

    let latestSelection!: Promise<void>;
    act(() => {
      latestSelection = current!.selectAgeBand("age13");
    });
    releaseFirstWrite();
    await act(async () => {
      await Promise.all([firstSelection, latestSelection]);
    });

    expect(persistedValue).toBe("age13");
    expect(current?.ageBand).toBe("age13");
  });

  it("supports an explicit automated-E2E age override without touching storage", async () => {
    await act(async () => {
      TestRenderer.create(
        <AudienceProvider initialAgeBandOverride="age14Plus">
          <Probe />
        </AudienceProvider>,
      );
      await Promise.resolve();
    });

    expect(current?.isHydrated).toBe(true);
    expect(current?.ageBand).toBe("age14Plus");
    expect(current?.policy.canAuthenticate).toBe(true);
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
