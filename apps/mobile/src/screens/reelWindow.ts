export const REEL_PAGE_WINDOW_SIZE = 7;
export const REEL_PAGE_WINDOW_EDGE = 2;

export type ReelWindow<T> = {
  items: T[];
  activeIndex: number;
  sourceStart: number;
};

function getSourceItem<T>(source: T[], logicalIndex: number) {
  return source[((logicalIndex % source.length) + source.length) % source.length];
}

function getWindowItems<T>(source: T[], sourceStart: number, size: number) {
  return Array.from({ length: size }, (_, index) =>
    getSourceItem(source, sourceStart + index),
  );
}

export function createReelWindow<T>(
  source: T[],
  sourceStart = 0,
  size = REEL_PAGE_WINDOW_SIZE,
): ReelWindow<T> {
  if (source.length === 0) {
    return { items: [], activeIndex: 0, sourceStart: 0 };
  }

  const windowSize = Math.max(1, size);
  return {
    items: getWindowItems(source, sourceStart, windowSize),
    activeIndex: 0,
    sourceStart,
  };
}

export function moveReelWindow<T>(
  current: ReelWindow<T>,
  source: T[],
  requestedIndex: number,
  size = REEL_PAGE_WINDOW_SIZE,
  edge = REEL_PAGE_WINDOW_EDGE,
): ReelWindow<T> {
  if (source.length === 0) {
    return { items: [], activeIndex: 0, sourceStart: 0 };
  }

  const windowSize = Math.max(1, size);
  const boundedIndex = Math.max(
    0,
    Math.min(requestedIndex, Math.max(0, current.items.length - 1)),
  );
  const safeEdge = Math.max(0, Math.min(edge, Math.floor((windowSize - 1) / 2)));
  const forwardAnchor = Math.max(safeEdge, windowSize - safeEdge - 1);
  const backwardAnchor = safeEdge;
  const logicalTarget = current.sourceStart + boundedIndex;
  let sourceStart = current.sourceStart;
  let activeIndex = boundedIndex;

  if (boundedIndex > forwardAnchor) {
    sourceStart = logicalTarget - forwardAnchor;
    activeIndex = forwardAnchor;
  } else if (boundedIndex < backwardAnchor) {
    sourceStart = logicalTarget - backwardAnchor;
    activeIndex = backwardAnchor;
  }

  return {
    items: getWindowItems(source, sourceStart, windowSize),
    activeIndex,
    sourceStart,
  };
}
