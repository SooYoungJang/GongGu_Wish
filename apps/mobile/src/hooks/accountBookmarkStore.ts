import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { publicGroupBuySchema } from "@gonggu/shared/schemas/group-buy";

import { fetchAccountBookmarks, setAccountBookmark, syncBookmark } from "../api";
import { canRecordBehaviorSignals } from "../audience/behaviorSignalsPolicy";
import type { GroupBuy } from "../types";
import type { BookmarkStoreDependencies } from "./bookmarkStore";
import type { StoredGroupBuy } from "./useLocalDeals";

type PendingBookmark = { id: string; selected: boolean; version: number; item?: StoredGroupBuy };
type BookmarkSnapshot = { bookmarks: StoredGroupBuy[]; ready: boolean; syncError: boolean };
const EMPTY: BookmarkSnapshot = { bookmarks: [], ready: false, syncError: false };
const stores = new Map<string, ReturnType<typeof createAccountBookmarkStore>>();
export const accountBookmarkStorageKey = (userId: string) => `@gonggu/bookmarks/account/v1/${encodeURIComponent(userId)}`;

function applyPending(items: StoredGroupBuy[], pending: Map<string, PendingBookmark>) {
  let next = items;
  for (const operation of pending.values()) {
    next = next.filter(item => item.id !== operation.id);
    if (operation.selected && operation.item) next = [operation.item, ...next];
  }
  return next;
}

export function createAccountBookmarkStore(userId: string, deps: BookmarkStoreDependencies) {
  const key = accountBookmarkStorageKey(userId);
  const listeners = new Set<() => void>();
  let snapshot = EMPTY;
  let loaded = false;
  let generation = 0;
  let version = 0;
  let pending = new Map<string, PendingBookmark>();
  let loading: Promise<void> | null = null;
  let syncing: Promise<void> | null = null;
  let persistence: Promise<void> = Promise.resolve();
  let resync = false;

  function publish(patch: Partial<BookmarkSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }

  function persist() {
    const expected = generation;
    const operation = persistence.catch(() => undefined).then(async () => {
      if (expected !== generation || !canRecordBehaviorSignals()) return;
      // One write commits the visible list and its unacknowledged changes together.
      await AsyncStorage.setItem(key, JSON.stringify({ bookmarks: snapshot.bookmarks, pending: [...pending.values()] }));
    });
    persistence = operation;
    return operation;
  }

  async function load() {
    if (loaded) return;
    if (loading) return loading;
    const expected = generation;
    const operation = (async () => {
      const raw = await AsyncStorage.getItem(key);
      let bookmarks: StoredGroupBuy[] = [];
      const savedPending = new Map<string, PendingBookmark>();
      if (raw) {
        const saved = JSON.parse(raw);
        for (const item of Array.isArray(saved.bookmarks) ? saved.bookmarks : []) {
          const parsed = publicGroupBuySchema.safeParse(item);
          if (parsed.success) bookmarks.push(deps.toStored(parsed.data));
        }
        for (const item of Array.isArray(saved.pending) ? saved.pending : []) {
          if (typeof item.id !== "string" || typeof item.selected !== "boolean" || !Number.isSafeInteger(item.version)) continue;
          const parsed = publicGroupBuySchema.safeParse(item.item);
          if (item.selected && (!parsed.success || parsed.data.id !== item.id)) continue;
          savedPending.set(item.id, { id: item.id, selected: item.selected, version: item.version, ...(parsed.success ? { item: deps.toStored(parsed.data) } : {}) });
          version = Math.max(version, item.version);
        }
      }
      if (expected !== generation || !canRecordBehaviorSignals()) return;
      pending = savedPending;
      loaded = true;
      publish({ bookmarks: applyPending(bookmarks, pending), ready: raw !== null });
    })();
    loading = operation;
    try { await operation; } finally { if (loading === operation) loading = null; }
  }

  function refresh(): Promise<void> {
    if (!canRecordBehaviorSignals()) return Promise.resolve();
    if (syncing) {
      resync = true;
      return syncing;
    }
    const expected = generation;
    const valid = () => expected === generation && canRecordBehaviorSignals();
    const operation = (async () => {
      do {
        resync = false;
        await load();
        await persist();
        if (!valid()) return;
        for (const change of [...pending.values()]) {
          if (!valid()) return;
          await setAccountBookmark(userId, change.id, change.selected);
          if (!valid()) return;
          // A response for an earlier save must never acknowledge a later removal.
          if (pending.get(change.id)?.version === change.version) pending.delete(change.id);
          await persist();
        }
        const remote = await fetchAccountBookmarks(userId);
        if (!valid()) return;
        publish({ bookmarks: applyPending(remote.map(deps.toStored), pending), ready: true, syncError: false });
        await persist();
      } while (resync && valid());
    })().catch(() => {
      if (valid()) publish({ ready: true, syncError: true });
    }).finally(() => {
      if (syncing === operation) syncing = null;
    });
    syncing = operation;
    return operation;
  }

  function mutate(id: string, selected: boolean, item?: StoredGroupBuy) {
    if (!canRecordBehaviorSignals()) return;
    const expected = generation;
    const change: PendingBookmark = { id, selected, version: ++version, ...(item ? { item } : {}) };
    pending.set(id, change);
    publish({ bookmarks: applyPending(snapshot.bookmarks, new Map([[id, change]])) });
    void persist().then(() => {
      if (expected !== generation || !canRecordBehaviorSignals()) return;
      // Popularity is an independent signal; it does not restore personal state.
      void syncBookmark(id, selected).catch(() => undefined);
      return refresh();
    }).catch(() => {
      if (expected === generation && canRecordBehaviorSignals()) publish({ syncError: true });
    });
  }

  function afterLoad(action: () => void) {
    if (!canRecordBehaviorSignals()) return;
    if (loaded) { action(); return; }
    const expected = generation;
    void load().then(() => {
      if (generation === expected && canRecordBehaviorSignals()) action();
    }).catch(() => {
      if (generation === expected && canRecordBehaviorSignals()) publish({ syncError: true });
    });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    toggleBookmark: (item: GroupBuy) => afterLoad(() => {
      mutate(item.id, !snapshot.bookmarks.some(entry => entry.id === item.id), deps.toStored(item));
    }),
    removeBookmark: (id: string) => afterLoad(() => mutate(id, false)),
    clear: async () => {
      generation += 1;
      pending.clear();
      publish({ bookmarks: [], ready: true, syncError: false });
      await persistence.catch(() => undefined);
      await AsyncStorage.removeItem(key);
      loaded = false;
      loading = null;
    },
  };
}

export async function clearAccountBookmarkStore(userId: string) {
  const store = stores.get(userId);
  if (store) await store.clear();
  else await AsyncStorage.removeItem(accountBookmarkStorageKey(userId));
}

export function useAccountBookmarkStore(deps: BookmarkStoreDependencies, userId: string | null) {
  let store = userId ? stores.get(userId) : undefined;
  if (userId && !store) {
    store = createAccountBookmarkStore(userId, deps);
    stores.set(userId, store);
  }
  const subscribe = useCallback((listener: () => void) => store?.subscribe(listener) ?? (() => {}), [store]);
  const getSnapshot = useCallback(() => store?.getSnapshot() ?? EMPTY, [store]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!store) return;
    void store.refresh();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void store?.refresh();
    });
    const unsubscribeOnline = onlineManager.subscribe(online => {
      if (online) void store?.refresh();
    });
    return () => { subscription.remove(); unsubscribeOnline(); };
  }, [store]);
  const bookmarks = canRecordBehaviorSignals() ? snapshot.bookmarks : EMPTY.bookmarks;
  const isBookmarked = useCallback((id: string) => bookmarks.some(item => item.id === id), [bookmarks]);
  const toggleBookmark = useCallback((item: GroupBuy) => store?.toggleBookmark(item), [store]);
  const removeBookmark = useCallback((id: string) => store?.removeBookmark(id), [store]);
  const refresh = useCallback(() => { void store?.refresh(); }, [store]);
  return {
    ...snapshot,
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refresh,
  };
}
