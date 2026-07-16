import { describe, expect, it } from 'vitest';

import {
  REEL_PAGE_WINDOW_SIZE,
  createReelWindow,
  moveReelWindow,
} from './reelWindow';

describe('reel window', () => {
  it('keeps a centered bounded window when moving forward', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const initial = createReelWindow(source);
    const next = moveReelWindow(initial, source, 5);

    expect(next.items).toHaveLength(REEL_PAGE_WINDOW_SIZE);
    expect(next.items[next.activeIndex]).toBe('f');
    expect(next.activeIndex).toBe(4);
    expect(next.sourceStart).toBe(1);
  });

  it('keeps a centered bounded window when moving backward', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const initial = createReelWindow(source, 3);
    const next = moveReelWindow(initial, source, 1);

    expect(next.items).toHaveLength(REEL_PAGE_WINDOW_SIZE);
    expect(next.items[next.activeIndex]).toBe('e');
    expect(next.activeIndex).toBe(2);
    expect(next.sourceStart).toBe(2);
  });

  it('does not grow after 100 forward transitions, even with a short source', () => {
    const source = ['a', 'b', 'c'];
    let current = createReelWindow(source);

    for (let index = 0; index < 100; index += 1) {
      current = moveReelWindow(
        current,
        source,
        Math.min(current.activeIndex + 1, current.items.length - 1),
      );
    }

    expect(current.items).toHaveLength(REEL_PAGE_WINDOW_SIZE);
    expect(current.activeIndex).toBe(4);
  });
});
