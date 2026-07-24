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

export function insertReelsAdSlots<T extends { id: string }>(
  items: T[],
  {
    enabled,
    firstAdAfter = 8,
    interval = 10,
  }: {
    enabled: boolean;
    firstAdAfter?: number;
    interval?: number;
  },
): ReelsFeedItem<T>[] {
  const feed: ReelsFeedItem<T>[] = [];
  let adSequence = 0;

  items.forEach((content, index) => {
    feed.push({ content, key: `content:${content.id}`, kind: "content" });
    const organicCount = index + 1;
    const isAdBreak =
      organicCount >= firstAdAfter &&
      (organicCount - firstAdAfter) % interval === 0;
    if (enabled && isAdBreak && organicCount < items.length) {
      adSequence += 1;
      feed.push({
        key: `ad:reels:${adSequence}:after:${content.id}`,
        kind: "ad",
        sequence: adSequence,
      });
    }
  });

  return feed;
}
