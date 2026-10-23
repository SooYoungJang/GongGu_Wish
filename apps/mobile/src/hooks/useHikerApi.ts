import { useCallback, useEffect, useRef, useState } from 'react';

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
  postAudioUrl?: string | null;
  postAudioStartTimeMs?: number | null;
  postAudioDurationMs?: number | null;
  postAudioLookupStatus?: 'FOUND' | 'NONE' | 'RETRYABLE';
  /** Post caption / summary text */
  caption: string | null;
  /** Instagram display name of the account (same as username) */
  authorName: string | null;
  /** Instagram username (handle without @) */
  authorUsername: string | null;
  /** Instagram profile image for the post author */
  profileImageUrl: string | null;
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
    postAudioUrl: info.postAudioUrl,
    postAudioStartTimeMs: info.postAudioStartTimeMs,
    postAudioDurationMs: info.postAudioDurationMs,
    postAudioLookupStatus: info.postAudioLookupStatus,
    caption: info.caption,
    likeCount: info.likeCount,
    authorName: info.username,
    authorUsername: info.username,
    profileImageUrl: info.profileImageUrl ?? null,
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
  const url = rawUrl.trim();
  const [state, setState] = useState<HikerState & { sourceUrl: string }>({
    ...IDLE_STATE,
    sourceUrl: '',
  });
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrlRef = useRef(url);
  currentUrlRef.current = url;

  const fetchPost = useCallback(async (sourceUrl: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading', data: null, error: null, sourceUrl });

    try {
      const info = await lookupInstagramUrl(sourceUrl);
      if (controller.signal.aborted || currentUrlRef.current !== sourceUrl) return;

      setState({
        status: 'success',
        data: toPostData(info),
        error: null,
        sourceUrl,
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || currentUrlRef.current !== sourceUrl) return;
      const message =
        error instanceof Error ? error.message : '게시물 정보를 불러오지 못했습니다.';
      setState({ status: 'error', data: null, error: message, sourceUrl });
    }
  }, []);

  // Invalidate immediately; only the network request is debounced.
  useEffect(() => {
    abortRef.current?.abort();
    setState({ ...IDLE_STATE, sourceUrl: url });
    if (isValidInstagramUrl(url)) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void fetchPost(url);
      }, 500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
    };
  }, [fetchPost, url]);

  function retry() {
    if (isValidInstagramUrl(url)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      void fetchPost(url);
    }
  }

  // Hide stale data even on the render before the invalidation effect runs.
  return { ...(state.sourceUrl === url ? state : IDLE_STATE), retry };
}
