export type ReelsContentItem<T extends { id: string }> = {
  content: T;
  key: string;
  kind: "content";
};

export type ReelsAdItem = {
  key: string;
  kind: "ad";
  sequence: number;
};

export type ReelsFeedItem<T extends { id: string }> =
  | ReelsContentItem<T>
  | ReelsAdItem;

export function isReelsContentItem<T extends { id: string }>(
  item: ReelsFeedItem<T>,
): item is ReelsContentItem<T> {
  return item.kind === "content";
}

/**
 * The inclusive range each ad gap is drawn from: an ad can surface after as
 * few as 2 or as many as 10 organic Reels, so breaks feel natural rather than
 * on a fixed metronome.
 */
export const REELS_AD_GAP_MIN = 2;
export const REELS_AD_GAP_MAX = 10;

export function seedAdRandomFromIds(ids: string[]): () => number {
  let hash = 1779033703 ^ ids.length;
  for (const id of ids) {
    for (let index = 0; index < id.length; index++) {
      hash = Math.imul(hash ^ id.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

export function insertReelsAdSlots<T extends { id: string }>(
  items: T[],
  {
    boundFirstGapToFeed = false,
    enabled,
    firstAdAfter,
    includeTrailingAd = false,
    interval,
    random = Math.random,
  }: {
    boundFirstGapToFeed?: boolean;
    enabled: boolean;
    firstAdAfter?: number;
    includeTrailingAd?: boolean;
    interval?: number;
    random?: () => number;
  },
): ReelsFeedItem<T>[] {
  // Every break (including the first) uses a uniform random gap in
  // [REELS_AD_GAP_MIN, REELS_AD_GAP_MAX]. Callers may pin firstAdAfter/
  // interval and inject a deterministic random for tests.
  const randomGap = (min: number, max: number) =>
    Math.min(
      REELS_AD_GAP_MAX,
      Math.max(min, Math.floor(random() * (max - min + 1)) + min),
    );

  const feed: ReelsFeedItem<T>[] = [];
  let adSequence = 0;
  const largestAvailableGap =
    items.length - (includeTrailingAd ? 0 : 1);
  const largestFirstGap = boundFirstGapToFeed
    ? Math.min(REELS_AD_GAP_MAX, largestAvailableGap)
    : REELS_AD_GAP_MAX;
  let gapToNextAd =
    firstAdAfter ??
    (largestFirstGap >= REELS_AD_GAP_MIN
      ? randomGap(REELS_AD_GAP_MIN, largestFirstGap)
      : Number.POSITIVE_INFINITY);
  const fixedGap = interval ?? null;

  items.forEach((content, index) => {
    feed.push({ content, key: `content:${content.id}`, kind: "content" });
    const organicCount = index + 1;
    if (
      !enabled ||
      (!includeTrailingAd && organicCount >= items.length) ||
      organicCount < gapToNextAd
    ) {
      return;
    }

    adSequence += 1;
    feed.push({
      key: `ad:reels:${adSequence}:after:${content.id}`,
      kind: "ad",
      sequence: adSequence,
    });
    gapToNextAd =
      organicCount +
      (fixedGap ?? randomGap(REELS_AD_GAP_MIN, REELS_AD_GAP_MAX));
  });

  return feed;
}
