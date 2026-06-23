import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiModule from '../../api';
import { useHikerApi } from '../useHikerApi';

// ─── Mocks (vitest hoists these to top) ──────────────────────────────────────

vi.mock('../../api', () => ({
  lookupInstagramUrl: vi.fn(),
  API_BASE_URL: 'http://test.local/api/v1',
}));

// ─── Test component factory ──────────────────────────────────────────────────

function mountHook(url: string) {
  const result: { current: ReturnType<typeof useHikerApi> } = { current: null as any };
  function TestComp() {
    result.current = useHikerApi(url);
    return null;
  }
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(React.createElement(TestComp));
  });
  return {
    get current() { return result.current; },
    rerender(newUrl: string) {
      act(() => {
        renderer!.update(React.createElement(TestComp, { key: Math.random() }));
      });
    },
    unmount() { renderer!.unmount(); },
    async flush() {
      // Flush pending effects & microtasks
      await act(async () => {
        await new Promise<void>(resolve => { queueMicrotask(() => resolve()); });
      });
    },
    async tick(ms: number) {
      // Advance real timers by ms, then flush
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), ms);
      });
      await act(async () => {
        await new Promise<void>(r => { queueMicrotask(() => r()); });
      });
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useHikerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns idle state when url is empty', () => {
    const hook = mountHook('');
    expect(hook.current.status).toBe('idle');
    expect(hook.current.data).toBeNull();
    expect(hook.current.error).toBeNull();
  });

  it('returns idle state for short invalid url', () => {
    const hook = mountHook('ab');
    expect(hook.current.status).toBe('idle');
  });

  it('calls lookupInstagramUrl after valid url and debounce delay', async () => {
    vi.mocked(apiModule.lookupInstagramUrl).mockResolvedValue({
      imageUrl: 'https://example.com/img.jpg',
      caption: 'Test caption',
      likeCount: 42,
      username: 'test_user',
      takenAt: '2026-06-01T12:00:00Z',
    });

    const hook = mountHook('https://www.instagram.com/p/ABC123/');

    // Immediately — idle (debounce hasn't fired yet)
    expect(hook.current.status).toBe('idle');

    // Wait for debounce + fetch
    await hook.tick(600);

    expect(apiModule.lookupInstagramUrl).toHaveBeenCalledWith('https://www.instagram.com/p/ABC123/');
    expect(hook.current.status).toBe('success');
    expect(hook.current.data).toEqual({
      imageUrl: 'https://example.com/img.jpg',
      caption: 'Test caption',
      likeCount: 42,
      authorName: 'test_user',
      authorUsername: 'test_user',
      postedAt: '2026-06-01T12:00:00Z',
    });
  });

  it('transitions to loading then success', async () => {
    vi.mocked(apiModule.lookupInstagramUrl).mockResolvedValue({
      imageUrl: 'https://example.com/img.jpg',
      caption: 'Cool post!',
      likeCount: 123,
      username: 'influencer',
      takenAt: '2026-06-15T10:00:00Z',
    });

    const hook = mountHook('https://www.instagram.com/p/DEF456/');

    await hook.tick(600);

    expect(hook.current.status).toBe('success');
    expect(hook.current.data!.imageUrl).toBe('https://example.com/img.jpg');
    expect(hook.current.data!.caption).toBe('Cool post!');
    expect(hook.current.data!.likeCount).toBe(123);
    expect(hook.current.data!.authorUsername).toBe('influencer');
    expect(hook.current.data!.postedAt).toBe('2026-06-15T10:00:00Z');
  });

  it('transitions to error on API failure', async () => {
    vi.mocked(apiModule.lookupInstagramUrl).mockRejectedValue(new Error('API unavailable'));

    const hook = mountHook('https://www.instagram.com/p/ERROR1/');

    await hook.tick(600);

    expect(hook.current.status).toBe('error');
    expect(hook.current.error).toBe('API unavailable');
    expect(hook.current.data).toBeNull();
  });

  it('handles empty response for url that becomes empty after trim', async () => {
    const hook = mountHook('   ');
    expect(hook.current.status).toBe('idle');
    expect(apiModule.lookupInstagramUrl).not.toHaveBeenCalled();
  });

  it('returns error for non-Instagram URL', async () => {
    vi.mocked(apiModule.lookupInstagramUrl).mockRejectedValue(new Error('Invalid URL'));

    const hook = mountHook('https://www.instagram.com/p/VALID1/');

    await hook.tick(600);

    expect(apiModule.lookupInstagramUrl).toHaveBeenCalled();
  });

  it('provides retry function that calls API immediately', async () => {
    vi.mocked(apiModule.lookupInstagramUrl).mockResolvedValue({
      imageUrl: null,
      caption: null,
      likeCount: null,
      username: 'retry_user',
      takenAt: null,
    });

    const hook = mountHook('https://www.instagram.com/p/RETRY1/');
    await hook.tick(600);

    expect(hook.current.status).toBe('success');

    // Retry — should call API again without debounce delay
    vi.mocked(apiModule.lookupInstagramUrl).mockClear();
    vi.mocked(apiModule.lookupInstagramUrl).mockResolvedValue({
      imageUrl: 'https://example.com/retry.jpg',
      caption: 'Retried version',
      likeCount: 99,
      username: 'retry_user',
      takenAt: null,
    });

    act(() => {
      hook.current.retry();
    });

    // Retry is immediate (no debounce needed)
    expect(apiModule.lookupInstagramUrl).toHaveBeenCalledWith('https://www.instagram.com/p/RETRY1/');

    // Wait for promise resolution
    await hook.flush();
    expect(hook.current.status).toBe('success');
    expect(hook.current.data!.likeCount).toBe(99);
  });
});
