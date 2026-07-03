import { useEffect, useMemo, useRef, useState } from 'react';

import { lookupInstagramUrl } from '../api';
import type { InstagramMediaInfo, MediaAsset } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HikerStatus = 'idle' | 'loading' | 'success' | 'error';

export interface HikerPostData {
  /** URL of the post's primary image */
  imageUrl: string | null;
  /** Best image for thumbnail (first carousel image or cover) */
  thumbnailUrl: string | null;
  /** Primary video URL if the post is a video/reel */
  videoUrl: string | null;
  /** All media URLs from carousel (images + videos) in post order */
  mediaUrls: string[];
  /** Ordered media assets with per-slide type information */
  mediaItems?: MediaAsset[];
  /** Dominant media type: IMAGE or VIDEO */
  mediaType: 'IMAGE' | 'VIDEO' | null;
  /** Post caption / summary text */
  caption: string | null;
  /** Instagram display name of the account (same as username) */
  authorName: string | null;
  /** Instagram username (handle without @) */
  authorUsername: string | null;
  /** Number of likes */
  likeCount: number | null;
  /** ISO date string of when the post was published */
  postedAt: string | null;
}

export interface HikerState {
  status: HikerStatus;
  data: HikerPostData | null;
  error: string | null;
}

// ─── Default state ───────────────────────────────────────────────────────────

const IDLE_STATE: HikerState = {
  status: 'idle',
  data: null,
  error: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert the API response (InstagramMediaInfo) to the hook's HikerPostData.
 */
function toPostData(info: InstagramMediaInfo): HikerPostData {
  return {
    imageUrl: info.imageUrl,
    thumbnailUrl: info.thumbnailUrl,
    videoUrl: info.videoUrl,
    mediaUrls: info.mediaUrls,
    mediaItems: info.mediaItems ?? [],
    mediaType: info.mediaType,
    caption: info.caption,
    likeCount: info.likeCount,
    authorName: info.username,
    authorUsername: info.username,
    postedAt: info.takenAt,
  };
}

/**
 * Validate that a URL looks like a real Instagram post URL (has /p/, /reel/, or /tv/).
 */
function isValidInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (
      !parsed.hostname.includes('instagram.com') &&
      !parsed.hostname.includes('instagr.am')
    ) {
      return false;
    }
    return /\/p\/|\/reel\/|\/tv\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useHikerApi — Fetch Instagram post metadata via HikerAPI.
 *
 * Takes a raw Instagram URL string and auto-fetches once the user stops
 * typing for 500 ms and the URL is valid.
 */
export function useHikerApi(rawUrl: string): HikerState & { retry: () => void } {
  const [state, setState] = useState<HikerState>(IDLE_STATE);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the raw URL with a 500ms delay.
  const [debouncedUrl, setDebouncedUrl] = useState('');
  useEffect(() => {
    if (rawUrl.trim().length < 5 || !isValidInstagramUrl(rawUrl)) {
      setDebouncedUrl('');
      return;
    }
    const timer = setTimeout(() => setDebouncedUrl(rawUrl.trim()), 500);
    return () => clearTimeout(timer);
  }, [rawUrl]);

  async function fetchPost(url: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Check signal hasn't been aborted
    if (controller.signal.aborted) return;

    setState({ status: 'loading', data: null, error: null });

    try {
      const info = await lookupInstagramUrl(url);

      // 🛑 If aborted while fetching, discard
      if (controller.signal.aborted) return;

      setState({
        status: 'success',
        data: toPostData(info),
        error: null,
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : '게시물 정보를 불러오지 못했습니다.';
      setState({ status: 'error', data: null, error: message });
    }
  }

  // Auto-fetch when the debounced URL changes
  useEffect(() => {
    if (!debouncedUrl) {
      setState(IDLE_STATE);
      return;
    }
    fetchPost(debouncedUrl);
    return () => abortRef.current?.abort();
  }, [debouncedUrl]);

  function retry() {
    if (rawUrl.trim()) {
      fetchPost(rawUrl.trim());
    }
  }

  return { ...state, retry };
}
