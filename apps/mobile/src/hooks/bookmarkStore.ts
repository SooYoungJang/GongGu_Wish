import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { canRecordBehaviorSignals } from "../audience/behaviorSignalsPolicy";
import { clearPopularitySignalOutbox } from "../services/popularitySignalOutbox";
import type { GroupBuy } from "../types";
import type { StoredGroupBuy } from "./useLocalDeals";

export const BOOKMARK_STORAGE_KEY = "@gonggu/bookmarks/v1";

// eslint-disable-next-line no-unused-vars
type BookmarkListener = (entries: StoredGroupBuy[]) => void;

type BookmarkStoreDependencies = {
  // eslint-disable-next-line no-unused-vars
  hydrateStored: (items: StoredGroupBuy[]) => Promise<StoredGroupBuy[]>;
  // eslint-disable-next-line no-unused-vars
  toStored: (item: GroupBuy) => StoredGroupBuy;
};

const listeners = new Set<BookmarkListener>();
let snapshot: StoredGroupBuy[] | null = null;
let refreshPromise: Promise<void> | null = null;
let persistence: Promise<unknown> = Promise.resolve();
let remoteSync: Promise<unknown> = Promise.resolve();
let revision = 0;
let cleanupInProgress = false;

function publish(entries: StoredGroupBuy[]): void {
  snapshot = entries;
  listeners.forEach((listener) => listener(entries));
}

function subscribe(listener: BookmarkListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function readStoredBookmarks(): Promise<StoredGroupBuy[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredGroupBuy[]) : [];
  } catch {
    return [];
  }
}

function persistSnapshot(
  expectedRevision: number,
  entries: StoredGroupBuy[],
): Promise<void> {
  const operation = persistence
    .catch(() => undefined)
    .then(async () => {
      if (
        expectedRevision !== revision ||
        cleanupInProgress ||
        !canRecordBehaviorSignals()
      ) {
        return;
      }
      await AsyncStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(entries));
    });
  persistence = operation.catch(() => undefined);
  return operation;
}

async function hydrate(
  hydrateStored: BookmarkStoreDependencies["hydrateStored"],
): Promise<void> {
  if (snapshot !== null || cleanupInProgress) return;
  if (refreshPromise) return refreshPromise;
  const expectedRevision = revision;
  const operation = (async () => {
    const stored = await readStoredBookmarks();
    if (
      expectedRevision !== revision ||
      cleanupInProgress ||
      !canRecordBehaviorSignals()
    ) {
      return;
    }
    const hydrated = await hydrateStored(stored);
    if (
      expectedRevision !== revision ||
      cleanupInProgress ||
      !canRecordBehaviorSignals()
    ) {
      return;
    }
    if (hydrated.some((item, index) => item !== stored[index])) {
      await persistSnapshot(expectedRevision, hydrated);
    }
    if (
      expectedRevision === revision &&
      !cleanupInProgress &&
      canRecordBehaviorSignals() &&
      snapshot === null
    ) {
      publish(hydrated);
    }
  })();
  refreshPromise = operation;
  try {
    await operation;
  } finally {
    if (refreshPromise === operation) refreshPromise = null;
  }
}

function commitMutation(
  entries: StoredGroupBuy[],
  groupBuyId: string,
  selected: boolean,
): void {
  if (cleanupInProgress || !canRecordBehaviorSignals()) return;
  const expectedRevision = revision;
  publish(entries);
  const localPersistence = persistSnapshot(expectedRevision, entries);
  const operation = remoteSync
    .catch(() => undefined)
    .then(async () => {
      await localPersistence;
      if (
        expectedRevision !== revision ||
        cleanupInProgress ||
        !canRecordBehaviorSignals()
      ) {
        return;
      }
      const { syncBookmark } = await import("../api");
      if (
        expectedRevision !== revision ||
        cleanupInProgress ||
        !canRecordBehaviorSignals()
      ) {
        return;
      }
      await syncBookmark(groupBuyId, selected);
    });
  remoteSync = operation.catch(() => undefined);
}

export async function clearBookmarkStore(): Promise<void> {
  revision += 1;
  cleanupInProgress = true;
  publish([]);
  try {
    await clearPopularitySignalOutbox().catch(() => undefined);
    await persistence.catch(() => undefined);
    await AsyncStorage.removeItem(BOOKMARK_STORAGE_KEY).catch(() => undefined);
  } finally {
    publish([]);
    snapshot = null;
    refreshPromise = null;
    cleanupInProgress = false;
  }
}

export function useBookmarkStore({
  hydrateStored,
  toStored,
}: BookmarkStoreDependencies) {
  const [bookmarks, setBookmarks] = useState<StoredGroupBuy[]>(
    () => snapshot ?? [],
  );
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!canRecordBehaviorSignals()) {
      publish([]);
      setReady(true);
      return;
    }
    if (snapshot !== null) {
      setBookmarks(snapshot);
      setReady(true);
      return;
    }
    void hydrate(hydrateStored).finally(() => setReady(true));
  }, [hydrateStored]);

  useEffect(() => {
    const unsubscribe = subscribe(setBookmarks);
    refresh();
    return unsubscribe;
  }, [refresh]);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((item) => item.id === id),
    [bookmarks],
  );

  const toggleBookmark = useCallback(
    (item: GroupBuy) => {
      if (!canRecordBehaviorSignals()) return;
      const current = snapshot ?? [];
      const selected = !current.some((entry) => entry.id === item.id);
      const next = selected
        ? [toStored(item), ...current]
        : current.filter((entry) => entry.id !== item.id);
      commitMutation(next, item.id, selected);
    },
    [toStored],
  );

  const removeBookmark = useCallback((id: string) => {
    if (!canRecordBehaviorSignals()) return;
    const current = snapshot ?? [];
    if (!current.some((entry) => entry.id === id)) return;
    commitMutation(
      current.filter((entry) => entry.id !== id),
      id,
      false,
    );
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refresh,
    ready,
  };
}
