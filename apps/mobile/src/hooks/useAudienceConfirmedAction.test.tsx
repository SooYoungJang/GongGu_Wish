import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audienceMock = vi.hoisted(() => ({
  canAuthenticate: false,
  selectAgeBand: vi.fn(),
}));

vi.mock("../audience/AudienceContext", () => ({
  useAudience: () => ({
    policy: { canAuthenticate: audienceMock.canAuthenticate },
    selectAgeBand: audienceMock.selectAgeBand,
  }),
}));

import { useAudienceConfirmedAction } from "./useAudienceConfirmedAction";

describe("useAudienceConfirmedAction", () => {
  beforeEach(() => {
    audienceMock.canAuthenticate = false;
    audienceMock.selectAgeBand.mockReset().mockResolvedValue(undefined);
  });

  it("confirms age before running a protected auth action", async () => {
    const execute = vi.fn(async () => undefined);
    const hook = renderHook(() => useAudienceConfirmedAction(execute));

    await act(async () => {
      await hook.result.current.run("kakao");
    });

    expect(audienceMock.selectAgeBand).toHaveBeenCalledWith("age14Plus");
    expect(execute).not.toHaveBeenCalled();
    expect(hook.result.current.confirming).toBe(true);

    audienceMock.canAuthenticate = true;
    await act(async () => {
      hook.rerender();
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("kakao");
    expect(hook.result.current.confirming).toBe(false);
  });

  it("waits for session restoration before draining the confirmed action", async () => {
    let ready = false;
    const execute = vi.fn(async () => undefined);
    const hook = renderHook(() =>
      useAudienceConfirmedAction(execute, { ready }),
    );

    await act(async () => {
      await hook.result.current.run("naver");
    });

    audienceMock.canAuthenticate = true;
    await act(async () => {
      hook.rerender();
      await Promise.resolve();
    });

    expect(execute).not.toHaveBeenCalled();
    expect(hook.result.current.confirming).toBe(true);

    ready = true;
    await act(async () => {
      hook.rerender();
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("naver");
  });

  it("does not drain the action until age confirmation persistence finishes", async () => {
    let resolveSelection!: () => void;
    audienceMock.selectAgeBand.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSelection = resolve;
      }),
    );
    const execute = vi.fn(async () => undefined);
    const hook = renderHook(() => useAudienceConfirmedAction(execute));
    let confirmation!: Promise<void>;

    act(() => {
      confirmation = hook.result.current.run("kakao");
    });
    audienceMock.canAuthenticate = true;
    await act(async () => {
      hook.rerender();
      await Promise.resolve();
    });

    expect(execute).not.toHaveBeenCalled();

    await act(async () => {
      resolveSelection();
      await confirmation;
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("kakao");
  });

  it("marks and cancels the auth intent around a failed age confirmation", async () => {
    const onActionStart = vi.fn();
    const onConfirmationFailure = vi.fn();
    const execute = vi.fn(async () => undefined);
    audienceMock.selectAgeBand.mockRejectedValueOnce(
      new Error("storage failed"),
    );
    const hook = renderHook(() =>
      useAudienceConfirmedAction(execute, {
        onConfirmationFailure,
        onActionStart,
      }),
    );

    await expect(
      act(async () => {
        await hook.result.current.run("apple");
      }),
    ).rejects.toThrow("storage failed");

    expect(onActionStart).toHaveBeenCalledTimes(1);
    expect(onConfirmationFailure).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(hook.result.current.confirming).toBe(false);
  });

  it("runs immediately when age confirmation is already stored", async () => {
    audienceMock.canAuthenticate = true;
    const execute = vi.fn(async () => undefined);
    const hook = renderHook(() => useAudienceConfirmedAction(execute));

    await act(async () => {
      await hook.result.current.run("email");
    });

    expect(audienceMock.selectAgeBand).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith("email");
  });

  it("ignores repeated requests while confirmation is pending", async () => {
    const execute = vi.fn(async () => undefined);
    const hook = renderHook(() => useAudienceConfirmedAction(execute));

    await act(async () => {
      await Promise.all([
        hook.result.current.run("kakao"),
        hook.result.current.run("naver"),
      ]);
    });

    expect(audienceMock.selectAgeBand).toHaveBeenCalledTimes(1);

    audienceMock.canAuthenticate = true;
    await act(async () => {
      hook.rerender();
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("kakao");
  });
});
