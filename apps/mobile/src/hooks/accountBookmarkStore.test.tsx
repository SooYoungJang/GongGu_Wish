import { act, renderHook, waitFor } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAudiencePolicy } from "../audience/audiencePolicy";
import { setAudiencePolicySnapshot } from "../audience/behaviorSignalsPolicy";
import type { GroupBuy } from "../types";
import { createAccountBookmarkStore, useAccountBookmarkStore } from "./accountBookmarkStore";

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  remote: new Map<string, GroupBuy[]>(),
  fail: false,
  diskFail: false,
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => mocks.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (mocks.diskFail) throw new Error("disk full");
    mocks.storage.set(key, value);
  },
  removeItem: async (key: string) => { mocks.storage.delete(key); },
} }));
vi.mock("../api", () => ({
  fetchAccountBookmarks: (...args: unknown[]) => mocks.read(...args),
  setAccountBookmark: (...args: unknown[]) => mocks.write(...args),
  syncBookmark: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));

const product = (id: string): GroupBuy => ({
  id, productName: id, brandName: null, startDate: null, endDate: null,
  purchaseUrl: null, discountInfo: null, summary: null, confidence: 1,
  thumbnailUrl: null, videoUrl: null, mediaUrls: [], mediaType: null,
  rawPost: { postUrl: "", influencer: { instagramUsername: "shop" } },
});
const deps = { toStored: (item: GroupBuy) => item, hydrateStored: async (items: GroupBuy[]) => items };

describe("account bookmarks", () => {
  beforeEach(() => {
    mocks.storage.clear(); mocks.remote.clear(); mocks.fail = false; mocks.diskFail = false;
    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
    mocks.read.mockReset().mockImplementation(async (user: string) => {
      if (mocks.fail) throw new Error("offline");
      return mocks.remote.get(user) ?? [];
    });
    mocks.write.mockReset().mockImplementation(async (user: string, id: string, selected: boolean) => {
      if (mocks.fail) throw new Error("offline");
      const remaining = (mocks.remote.get(user) ?? []).filter(item => item.id !== id);
      mocks.remote.set(user, selected ? [product(id), ...remaining] : remaining);
    });
  });

  it("restores server bookmarks in a fresh store without claiming guest data", async () => {
    mocks.storage.set("@gonggu/bookmarks/v1", JSON.stringify([product("guest")]));
    mocks.remote.set("restore-user", [product("saved-on-another-device")]);
    const store = createAccountBookmarkStore("restore-user", deps);
    await store.refresh();
    expect(store.getSnapshot().bookmarks.map(item => item.id)).toEqual(["saved-on-another-device"]);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.storage.get("@gonggu/bookmarks/v1")).toContain("guest");
  });

  it("keeps offline removals durable and replays them before merging server data", async () => {
    mocks.remote.set("offline-user", [product("saved")]);
    const first = createAccountBookmarkStore("offline-user", deps);
    await first.refresh();
    mocks.fail = true;
    first.removeBookmark("saved");
    await first.refresh();
    expect(first.getSnapshot().bookmarks).toEqual([]);
    expect(first.getSnapshot().syncError).toBe(true);
    const restarted = createAccountBookmarkStore("offline-user", deps);
    mocks.fail = false;
    await restarted.refresh();
    expect(mocks.write).toHaveBeenLastCalledWith("offline-user", "saved", false);
    expect(restarted.getSnapshot().bookmarks).toEqual([]);
    expect(mocks.remote.get("offline-user")).toEqual([]);
  });

  it("preserves a removal made while an earlier save is still uploading", async () => {
    const store = createAccountBookmarkStore("race-user", deps);
    await store.refresh();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.write.mockImplementationOnce(async (user: string, id: string) => {
      await gate;
      mocks.remote.set(user, [product(id)]);
    });
    store.toggleBookmark(product("rapid"));
    await waitFor(() => expect(mocks.write).toHaveBeenCalled());
    store.removeBookmark("rapid");
    release();
    await store.refresh();
    expect(store.getSnapshot().bookmarks).toEqual([]);
    expect(mocks.remote.get("race-user")).toEqual([]);
  });

  it("never renders another account's data, including a late response", async () => {
    let resolveA!: (items: GroupBuy[]) => void;
    mocks.read.mockImplementationOnce(() => new Promise<GroupBuy[]>(resolve => { resolveA = resolve; }));
    mocks.remote.set("isolation-b", [product("only-b")]);
    const hook = renderHook(({ user }) => useAccountBookmarkStore(deps, user), { initialProps: { user: "isolation-a" as string | null } });
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("isolation-a"));
    hook.rerender({ user: "isolation-b" });
    expect(hook.result.current.bookmarks).toEqual([]);
    await waitFor(() => expect(hook.result.current.bookmarks[0]?.id).toBe("only-b"));
    await act(async () => { resolveA([product("only-a")]); });
    expect(hook.result.current.bookmarks.map(item => item.id)).toEqual(["only-b"]);
    hook.rerender({ user: null });
    expect(hook.result.current.bookmarks).toEqual([]);
  });

  it("keeps an uncached account loading until its first server response", async () => {
    let release!: (items: GroupBuy[]) => void;
    mocks.read.mockImplementationOnce(() => new Promise<GroupBuy[]>(resolve => { release = resolve; }));
    const store = createAccountBookmarkStore("loading-user", deps);
    const refresh = store.refresh();
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("loading-user"));
    expect(store.getSnapshot().ready).toBe(false);
    release([product("restored")]);
    await refresh;
    expect(store.getSnapshot().ready).toBe(true);
  });

  it("retries when connectivity returns without requiring an app restart", async () => {
    mocks.fail = true;
    onlineManager.setOnline(false);
    const hook = renderHook(() => useAccountBookmarkStore(deps, "reconnect-user"));
    await waitFor(() => expect(hook.result.current.syncError).toBe(true));
    mocks.fail = false;
    mocks.remote.set("reconnect-user", [product("restored-online")]);
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(hook.result.current.bookmarks[0]?.id).toBe("restored-online"));
    const refresh = hook.result.current.refresh;
    hook.rerender();
    expect(hook.result.current.refresh).toBe(refresh);
    hook.unmount();
  });

  it("does not upload before durable storage succeeds and recovers on retry", async () => {
    const store = createAccountBookmarkStore("disk-user", deps);
    await store.refresh();
    mocks.diskFail = true;
    store.toggleBookmark(product("unsaved"));
    await waitFor(() => expect(store.getSnapshot().syncError).toBe(true));
    expect(mocks.write).not.toHaveBeenCalled();
    mocks.diskFail = false;
    await store.refresh();
    expect(mocks.remote.get("disk-user")?.[0]?.id).toBe("unsaved");
    expect(store.getSnapshot().syncError).toBe(false);
  });

  it("clears only its account and ignores a response already in flight", async () => {
    const store = createAccountBookmarkStore("clear-a", deps);
    const other = createAccountBookmarkStore("clear-b", deps);
    mocks.remote.set("clear-b", [product("keep-b")]);
    await other.refresh();
    let release!: (items: GroupBuy[]) => void;
    const delayed = new Promise<GroupBuy[]>(resolve => { release = resolve; });
    mocks.read.mockImplementationOnce(() => delayed);
    const refreshing = store.refresh();
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("clear-a"));
    await store.clear();
    release([product("late-a")]);
    await refreshing;
    expect(store.getSnapshot().bookmarks).toEqual([]);
    expect(other.getSnapshot().bookmarks[0]?.id).toBe("keep-b");
    expect([...mocks.storage.keys()].some(key => key.endsWith("clear-a"))).toBe(false);
  });

  it("does not load or upload bookmarks under a restricted audience policy", async () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age13"));
    const store = createAccountBookmarkStore("restricted-user", deps);
    store.toggleBookmark(product("blocked"));
    await store.refresh();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.storage.size).toBe(0);
  });
});
