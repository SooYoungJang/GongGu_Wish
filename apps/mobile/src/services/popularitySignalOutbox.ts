import AsyncStorage from "@react-native-async-storage/async-storage";

import { canRecordBehaviorSignals } from "../audience/behaviorSignalsPolicy";
import { ApiError } from "../lib/api-types";
import { postgrestFetch } from "../lib/postgrest-client";
import { resolveSupabaseUrl } from "../lib/supabase-config";

export const POPULARITY_SIGNAL_OUTBOX_KEY =
  "@gonggu/popularity-signal-outbox/v1";

const MAX_DEEP_VIEW_ENTRIES = 500;
const MAX_BOOKMARK_ENTRIES = 500;
const MAX_IDENTIFIER_LENGTH = 256;
const RETRYABLE_CLIENT_STATUSES = new Set([401, 403, 404, 408, 425, 429]);

type DeepViewSignal = {
  backendScope: string;
  id: string;
  kind: "deepView";
  groupBuyId: string;
  sessionId: string;
  occurredAt: string;
};

type BookmarkSignal = {
  backendScope: string;
  id: string;
  kind: "bookmark";
  groupBuyId: string;
  sessionId: string;
  selected: boolean;
  occurredAt: string;
};

type PopularitySignal = DeepViewSignal | BookmarkSignal;

let storageChain: Promise<unknown> = Promise.resolve();
let flushChain: Promise<unknown> = Promise.resolve();
let generation = 0;
let activeRequest: AbortController | null = null;

export function capturePopularitySignalGeneration(): number {
  return generation;
}

function getBackendScope(): string {
  try {
    return new URL(resolveSupabaseUrl()).host;
  } catch {
    return "unconfigured.invalid";
  }
}

function isBoundedIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH
  );
}

function isPopularitySignal(value: unknown): value is PopularitySignal {
  if (!value || typeof value !== "object") return false;
  const signal = value as Record<string, unknown>;
  if (
    !isBoundedIdentifier(signal.id) ||
    !isBoundedIdentifier(signal.backendScope) ||
    !isBoundedIdentifier(signal.groupBuyId) ||
    !isBoundedIdentifier(signal.sessionId) ||
    typeof signal.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(signal.occurredAt))
  ) {
    return false;
  }
  if (signal.kind === "deepView") return true;
  return signal.kind === "bookmark" && typeof signal.selected === "boolean";
}

function limitOutbox(signals: PopularitySignal[]): PopularitySignal[] {
  const deepViewIds = new Set(
    signals
      .filter((signal) => signal.kind === "deepView")
      .slice(-MAX_DEEP_VIEW_ENTRIES)
      .map((signal) => signal.id),
  );
  const bookmarkIds = new Set(
    signals
      .filter((signal) => signal.kind === "bookmark")
      .slice(-MAX_BOOKMARK_ENTRIES)
      .map((signal) => signal.id),
  );
  const lastIndexById = new Map<string, number>();
  signals.forEach((signal, index) => lastIndexById.set(signal.id, index));
  return signals.filter(
    (signal, index) =>
      lastIndexById.get(signal.id) === index &&
      (signal.kind === "deepView"
        ? deepViewIds.has(signal.id)
        : bookmarkIds.has(signal.id)),
  );
}

function isPermanentSignalError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    !RETRYABLE_CLIENT_STATUSES.has(error.status)
  );
}

async function readOutbox(): Promise<PopularitySignal[]> {
  const raw = await AsyncStorage.getItem(POPULARITY_SIGNAL_OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const backendScope = getBackendScope();
    const deepViewCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return limitOutbox(
      parsed
        .filter(isPopularitySignal)
        .filter((signal) => signal.backendScope === backendScope)
        .filter(
          (signal) =>
            signal.kind === "bookmark" ||
            Date.parse(signal.occurredAt) >= deepViewCutoff,
        ),
    );
  } catch {
    return [];
  }
}

async function writeOutbox(signals: PopularitySignal[]): Promise<void> {
  if (signals.length === 0) {
    await AsyncStorage.removeItem(POPULARITY_SIGNAL_OUTBOX_KEY);
    return;
  }
  await AsyncStorage.setItem(
    POPULARITY_SIGNAL_OUTBOX_KEY,
    JSON.stringify(limitOutbox(signals)),
  );
}

function runStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = storageChain.catch(() => undefined).then(operation);
  storageChain = next.catch(() => undefined);
  return next;
}

function createDeepViewEventId(sessionId: string): string {
  const sessionSuffix = sessionId.slice(-64);
  return `dv:${sessionSuffix}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

async function enqueueSignal(
  signal: PopularitySignal,
  expectedGeneration: number,
): Promise<void> {
  const enqueued = await runStorageOperation(async () => {
    if (expectedGeneration !== generation || !canRecordBehaviorSignals()) {
      return false;
    }
    const current = await readOutbox();
    if (expectedGeneration !== generation || !canRecordBehaviorSignals()) {
      return false;
    }
    const withoutSupersededBookmark =
      signal.kind === "bookmark"
        ? current.filter(
            (entry) =>
              entry.kind !== "bookmark" ||
              entry.groupBuyId !== signal.groupBuyId ||
              entry.sessionId !== signal.sessionId,
          )
        : current;
    await writeOutbox([...withoutSupersededBookmark, signal]);
    return true;
  });
  if (enqueued) {
    void flushPopularitySignalOutbox().catch(() => undefined);
  }
}

async function sendSignal(signal: PopularitySignal): Promise<void> {
  const controller = new AbortController();
  activeRequest = controller;
  const requestSignal = controller.signal;
  if (signal.kind === "deepView") {
    try {
      await postgrestFetch("rpc/record_group_buy_deep_view", {
        method: "POST",
        body: {
          p_group_buy_id: signal.groupBuyId,
          p_session_id: signal.sessionId,
          p_client_event_id: signal.id,
          p_viewed_at: signal.occurredAt,
        },
        signal: requestSignal,
      });
    } finally {
      if (activeRequest === controller) activeRequest = null;
    }
    return;
  }

  try {
    await postgrestFetch("rpc/set_group_buy_bookmark", {
      method: "POST",
      body: {
        p_group_buy_id: signal.groupBuyId,
        p_session_id: signal.sessionId,
        p_selected: signal.selected,
      },
      signal: requestSignal,
    });
  } finally {
    if (activeRequest === controller) activeRequest = null;
  }
}

export async function enqueueDeepViewSignal(
  groupBuyId: string,
  sessionId: string,
  expectedGeneration = generation,
): Promise<void> {
  if (expectedGeneration !== generation || !canRecordBehaviorSignals()) {
    return;
  }
  const occurredAt = new Date().toISOString();
  await enqueueSignal(
    {
      backendScope: getBackendScope(),
      id: createDeepViewEventId(sessionId),
      kind: "deepView",
      groupBuyId,
      sessionId,
      occurredAt,
    },
    expectedGeneration,
  );
}

export async function enqueueBookmarkSignal(
  groupBuyId: string,
  sessionId: string,
  selected: boolean,
  expectedGeneration = generation,
): Promise<void> {
  if (expectedGeneration !== generation || !canRecordBehaviorSignals()) {
    return;
  }
  const occurredAt = new Date().toISOString();
  await enqueueSignal(
    {
      backendScope: getBackendScope(),
      id: `bm:${sessionId.slice(-32)}:${Date.now().toString(36)}:${Math.random()
        .toString(36)
        .slice(2, 14)}`,
      kind: "bookmark",
      groupBuyId,
      sessionId,
      selected,
      occurredAt,
    },
    expectedGeneration,
  );
}

export function flushPopularitySignalOutbox(): Promise<void> {
  const flush = flushChain
    .catch(() => undefined)
    .then(async () => {
      while (true) {
        if (!canRecordBehaviorSignals()) return;
        const currentGeneration = generation;
        let signal: PopularitySignal | null;
        try {
          signal = await runStorageOperation(async () => {
            const current = await readOutbox();
            return current[0] ?? null;
          });
        } catch {
          return;
        }
        if (!signal) return;
        if (currentGeneration !== generation || !canRecordBehaviorSignals()) {
          return;
        }

        try {
          await sendSignal(signal);
        } catch (error) {
          if (!isPermanentSignalError(error)) return;
          console.warn("[Popularity] discarded non-retryable signal", {
            kind: signal.kind,
            status: error.status,
          });
        }
        if (currentGeneration !== generation || !canRecordBehaviorSignals()) {
          return;
        }

        await runStorageOperation(async () => {
          const current = await readOutbox();
          await writeOutbox(current.filter((entry) => entry.id !== signal.id));
        });
      }
    });
  flushChain = flush.catch(() => undefined);
  return flush;
}

export async function clearPopularitySignalOutbox(): Promise<void> {
  generation += 1;
  activeRequest?.abort();
  activeRequest = null;
  await runStorageOperation(() =>
    AsyncStorage.removeItem(POPULARITY_SIGNAL_OUTBOX_KEY),
  );
}
