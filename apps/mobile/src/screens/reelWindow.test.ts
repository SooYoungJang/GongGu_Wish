import { describe, expect, it } from 'vitest';

import {
  REEL_PAGE_WINDOW_SIZE,
  createReelWindow,
  moveReelWindow,
} from './reelWindow';

describe('reel window', () => {
  it('keeps a bounded window with forward runway after moving forward', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const initial = createReelWindow(source);
    const next = moveReelWindow(initial, source, 9);

    expect(next.items).toHaveLength(REEL_PAGE_WINDOW_SIZE);
    expect(next.items[next.activeIndex]).toBe('j');
    expect(next.activeIndex).toBe(2);
    expect(next.sourceStart).toBe(7);
  });

  it('keeps forward runway after recentering instead of shifting every swipe', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const initial = createReelWindow(source);
    const recentered = moveReelWindow(initial, source, 9);
    const next = moveReelWindow(
      recentered,
      source,
      recentered.activeIndex + 1,
    );

    expect(next.items[next.activeIndex]).toBe('k');
    expect(next.sourceStart).toBe(recentered.sourceStart);
  });

  it('keeps six forward swipes stable between window recenters', () => {
    const source = Array.from({ length: 12 }, (_, index) => `item-${index}`);
    const initial = createReelWindow(source);
    const recentered = moveReelWindow(
      initial,
      source,
      initial.items.length - 2,
    );
    let current = recentered;

    for (let index = 0; index < 6; index += 1) {
      current = moveReelWindow(
        current,
        source,
        current.activeIndex + 1,
      );
    }

    expect(current.sourceStart).toBe(recentered.sourceStart);
  });

  it('keeps a bounded window with backward runway after moving backward', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const initial = createReelWindow(source, 3);
    const next = moveReelWindow(initial, source, 1);

    expect(next.items).toHaveLength(REEL_PAGE_WINDOW_SIZE);
    expect(next.items[next.activeIndex]).toBe('e');
    expect(next.activeIndex).toBe(8);
    expect(next.sourceStart).toBe(-4);
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
    expect(current.activeIndex).toBeGreaterThanOrEqual(0);
    expect(current.activeIndex).toBeLessThan(REEL_PAGE_WINDOW_SIZE);
  });
});
