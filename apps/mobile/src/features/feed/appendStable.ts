import { useRef } from "react";

function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function isFeedAppend(previous: string[], next: string[]) {
  return next.length >= previous.length && previous.every((key, index) => key === next[index]);
}

export function useAppendStableKey(keys: string[]) {
  const previous = useRef({ keys, revision: 0 });
  if (!isFeedAppend(previous.current.keys, keys)) previous.current.revision += 1;
  previous.current.keys = keys;
  return `feed:${previous.current.revision}`;
}

export function mergeShuffledPageItems<T extends { id: string }>(
  previous: { sourceIds: string[]; items: T[] } | undefined,
  incoming: T[],
  shuffleItems: (items: T[]) => T[] = shuffle,
) {
  const sourceIds = incoming.map(item => item.id);
  if (!previous || !isFeedAppend(previous.sourceIds, sourceIds)) {
    return { sourceIds, items: shuffleItems(incoming.slice()) };
  }
  const byId = new Map(incoming.map(item => [item.id, item]));
  return {
    sourceIds,
    items: [
      ...previous.items.map(item => byId.get(item.id)!),
      ...shuffleItems(incoming.slice(previous.sourceIds.length)),
    ],
  };
}
