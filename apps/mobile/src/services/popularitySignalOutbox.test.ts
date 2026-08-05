import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-types";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
const postgrestFetch = vi.hoisted(() => vi.fn());
const behaviorSignalsAllowed = vi.hoisted(() => vi.fn(() => true));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
vi.mock("../lib/postgrest-client", () => ({ postgrestFetch }));
vi.mock("../audience/behaviorSignalsPolicy", () => ({
  canRecordBehaviorSignals: behaviorSignalsAllowed,
}));

import {
  POPULARITY_SIGNAL_OUTBOX_KEY,
  capturePopularitySignalGeneration,
  clearPopularitySignalOutbox,
  enqueueBookmarkSignal,
  enqueueDeepViewSignal,
  flushPopularitySignalOutbox,
} from "./popularitySignalOutbox";

describe("popularity signal outbox", () => {
  let storedValue: string | null;

  beforeEach(() => {
    storedValue = null;
    storage.getItem.mockReset().mockImplementation(async () => storedValue);
    storage.setItem
      .mockReset()
      .mockImplementation(async (_key: string, value: string) => {
        storedValue = value;
      });
    storage.removeItem.mockReset().mockImplementation(async () => {
      storedValue = null;
    });
    postgrestFetch.mockReset().mockResolvedValue({ data: null });
    behaviorSignalsAllowed.mockReset().mockReturnValue(true);
  });

  it("retains a failed deep view and retries the same idempotency key", async () => {
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));

    await enqueueDeepViewSignal("group-buy-1", "session-1");
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));

    expect(JSON.parse(storedValue ?? "[]")).toHaveLength(1);
    const firstBody = postgrestFetch.mock.calls[0]?.[1]?.body;

    await flushPopularitySignalOutbox();

    const retryBody = postgrestFetch.mock.calls[1]?.[1]?.body;
    expect(retryBody.p_client_event_id).toBe(firstBody.p_client_event_id);
    expect(postgrestFetch.mock.calls[1]?.[0]).toContain(
      "rpc/record_group_buy_deep_view",
    );
    expect(JSON.parse(storedValue ?? "[]")).toEqual([]);
  });

  it("coalesces bookmark state and uses an idempotent server mutation", async () => {
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));

    await enqueueBookmarkSignal("group-buy-1", "session-1", true);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(storedValue ?? "[]")).toHaveLength(1);

    await enqueueBookmarkSignal("group-buy-1", "session-1", true);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(2));

    expect(postgrestFetch.mock.calls[1]?.[0]).toBe(
      "rpc/set_group_buy_bookmark",
    );
    expect(postgrestFetch.mock.calls[1]?.[1]?.body).toMatchObject({
      p_selected: true,
    });
    expect(JSON.parse(storedValue ?? "[]")).toEqual([]);
  });

  it("replaces a queued bookmark with the latest local state", async () => {
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));
    await enqueueBookmarkSignal("group-buy-1", "session-1", true);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));

    await enqueueBookmarkSignal("group-buy-1", "session-1", false);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(2));

    expect(postgrestFetch.mock.calls[1]?.[0]).toBe(
      "rpc/set_group_buy_bookmark",
    );
    expect(postgrestFetch.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: { p_selected: false },
    });
    expect(JSON.parse(storedValue ?? "[]")).toEqual([]);
  });

  it("does not let an in-flight bookmark delete a newer mutation", async () => {
    let releaseFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    postgrestFetch.mockImplementationOnce(() => firstRequest);

    const selecting = enqueueBookmarkSignal("group-buy-1", "session-1", true);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));

    const deselecting = enqueueBookmarkSignal(
      "group-buy-1",
      "session-1",
      false,
    );
    releaseFirst();
    await Promise.all([selecting, deselecting]);
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(2));

    expect(postgrestFetch).toHaveBeenCalledTimes(2);
    expect(postgrestFetch.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: { p_selected: false },
    });
    expect(JSON.parse(storedValue ?? "[]")).toEqual([]);
  });

  it("stores the queue under the restricted-audience cleanup key", async () => {
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));
    await enqueueDeepViewSignal("group-buy-1", "session-1");
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));

    expect(storage.setItem).toHaveBeenCalledWith(
      POPULARITY_SIGNAL_OUTBOX_KEY,
      expect.any(String),
    );
  });

  it("keeps pending signals without sending after behavior signals are disabled", async () => {
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));
    await enqueueDeepViewSignal("group-buy-1", "session-1");
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));

    behaviorSignalsAllowed.mockReturnValue(false);
    await flushPopularitySignalOutbox();

    expect(postgrestFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storedValue ?? "[]")).toHaveLength(1);
  });

  it("aborts an in-flight flush when local behavior data is cleared", async () => {
    postgrestFetch.mockImplementationOnce(
      (_path: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const enqueueing = enqueueDeepViewSignal("group-buy-1", "session-1");
    await vi.waitFor(() => expect(postgrestFetch).toHaveBeenCalledTimes(1));
    const requestSignal = postgrestFetch.mock.calls[0]?.[1]?.signal;

    await clearPopularitySignalOutbox();
    await enqueueing;

    expect(requestSignal?.aborted).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledWith(
      POPULARITY_SIGNAL_OUTBOX_KEY,
    );
    expect(storedValue).toBeNull();
  });

  it("does not send a signal whose storage read crossed a cleanup boundary", async () => {
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    storage.getItem.mockImplementationOnce(async () => {
      await readGate;
      return storedValue;
    });

    const enqueueing = enqueueDeepViewSignal("group-buy-1", "session-1");
    await vi.waitFor(() => expect(storage.getItem).toHaveBeenCalledTimes(1));
    const clearing = clearPopularitySignalOutbox();
    releaseRead();
    await Promise.all([enqueueing, clearing]);

    expect(postgrestFetch).not.toHaveBeenCalled();
    expect(storedValue).toBeNull();
  });

  it("rejects a delayed producer from before local behavior data was cleared", async () => {
    const staleGeneration = capturePopularitySignalGeneration();
    await clearPopularitySignalOutbox();

    await enqueueBookmarkSignal(
      "group-buy-1",
      "session-1",
      true,
      staleGeneration,
    );

    expect(postgrestFetch).not.toHaveBeenCalled();
    expect(storedValue).toBeNull();
  });

  it("discards a permanent client error without blocking later signals", async () => {
    const occurredAt = new Date().toISOString();
    storedValue = JSON.stringify([
      {
        backendScope: "unconfigured.invalid",
        id: "deep-view-deleted",
        kind: "deepView",
        groupBuyId: "deleted-group-buy",
        sessionId: "session-1",
        occurredAt,
      },
      {
        backendScope: "unconfigured.invalid",
        id: "deep-view-valid",
        kind: "deepView",
        groupBuyId: "group-buy-1",
        sessionId: "session-1",
        occurredAt,
      },
    ]);
    postgrestFetch
      .mockRejectedValueOnce(new ApiError(409, "foreign key violation"))
      .mockResolvedValueOnce({ data: null });

    await flushPopularitySignalOutbox();

    expect(postgrestFetch).toHaveBeenCalledTimes(2);
    expect(storedValue).toBeNull();
  });

  it("keeps bookmark intent when deep-view traffic reaches its cap", async () => {
    const occurredAt = new Date().toISOString();
    storedValue = JSON.stringify([
      {
        backendScope: "unconfigured.invalid",
        id: "bookmark-protected",
        kind: "bookmark",
        groupBuyId: "group-buy-bookmarked",
        sessionId: "session-1",
        selected: true,
        occurredAt,
      },
      ...Array.from({ length: 500 }, (_, index) => ({
        backendScope: "unconfigured.invalid",
        id: `deep-view-${index}`,
        kind: "deepView",
        groupBuyId: `group-buy-${index}`,
        sessionId: "session-1",
        occurredAt,
      })),
    ]);
    postgrestFetch.mockRejectedValueOnce(new TypeError("offline"));

    await enqueueDeepViewSignal("group-buy-new", "session-1");

    const pending = JSON.parse(storedValue ?? "[]") as Array<{
      id: string;
      kind: string;
    }>;
    expect(pending.filter((signal) => signal.kind === "deepView")).toHaveLength(
      500,
    );
    expect(pending.some((signal) => signal.id === "bookmark-protected")).toBe(
      true,
    );
  });

  it("does not overwrite pending signals when storage cannot be read", async () => {
    const existing = JSON.stringify([
      {
        backendScope: "unconfigured.invalid",
        id: "deep-view-existing",
        kind: "deepView",
        groupBuyId: "group-buy-existing",
        sessionId: "session-existing",
        occurredAt: new Date().toISOString(),
      },
    ]);
    storedValue = existing;
    storage.getItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      enqueueBookmarkSignal("group-buy-1", "session-1", true),
    ).rejects.toThrow("storage unavailable");

    expect(storedValue).toBe(existing);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
