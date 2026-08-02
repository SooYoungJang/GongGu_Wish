export type PostAudioInfo = {
  postAudioUrl: string | null;
  postAudioStartTimeMs: number | null;
  postAudioDurationMs: number | null;
};

export type PostAudioLookupStatus = "FOUND" | "NONE" | "RETRYABLE";

export type ResolvedPostAudioInfo = PostAudioInfo & {
  postAudioLookupStatus: PostAudioLookupStatus;
};

type AudioCandidate = PostAudioInfo & {
  canonicalId: string | null;
  isMuted: boolean;
  trackId: string | null;
};

type Fetcher = typeof fetch;

const AUDIO_WALK_MAX_DEPTH = 8;
const AUDIO_WALK_MAX_NODES = 512;
const INSTAGRAM_CDN_URL_MAX_LENGTH = 8_192;
const INSTAGRAM_CDN_URL_PATTERN =
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:cdninstagram\.com|fbcdn\.net)(?:[/?#]|$)/iu;
const HIKER_TRACK_TIMEOUT_MS = 6_000;
const VIDEO_PROBE_BYTES = 1024 * 1024;
const VIDEO_PROBE_MAX_CANDIDATES = 3;
const VIDEO_PROBE_MAX_CAROUSEL_RECORDS = 6;
const VIDEO_PROBE_RECORD_CONCURRENCY = 2;
const VIDEO_PROBE_TIMEOUT_MS = 2_000;

const EMPTY_POST_AUDIO: PostAudioInfo = {
  postAudioUrl: null,
  postAudioStartTimeMs: null,
  postAudioDurationMs: null,
};

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return null;
}

function getNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function getPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

export function trustedInstagramCdnUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > INSTAGRAM_CDN_URL_MAX_LENGTH) {
    return null;
  }
  if (!INSTAGRAM_CDN_URL_PATTERN.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === "cdninstagram.com" ||
      hostname.endsWith(".cdninstagram.com") ||
      hostname === "fbcdn.net" ||
      hostname.endsWith(".fbcdn.net");
    if (
      url.protocol !== "https:" ||
      !trustedHost ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function isInstagramCdnUrl(value?: string | null): boolean {
  return trustedInstagramCdnUrl(value) !== null;
}

const ASSOCIATED_AUDIO_KEYS = [
  "music_asset_info",
  "music_consumption_info",
  "audio_asset_info",
  "audio_muting_info",
] as const;

function isMutedRecord(record: Record<string, unknown>): boolean {
  const mutingInfo = getRecord(record.audio_muting_info);
  return record.should_mute_audio === true ||
    record.is_music_page_restricted === true ||
    mutingInfo?.mute_audio === true;
}

function associatedAudioRecords(
  anchor: Record<string, unknown>,
): Record<string, unknown>[] {
  const records = [anchor];
  for (const key of ASSOCIATED_AUDIO_KEYS) {
    const child = getRecord(anchor[key]);
    if (child) records.push(child);
  }
  return records;
}

function candidateFromAnchor(
  anchor: Record<string, unknown>,
  inheritedMuted: boolean,
): AudioCandidate | null {
  let fastStartUrl: string | null = null;
  let progressiveUrl: string | null = null;
  let reactiveUrl: string | null = null;
  let startTimeMs: number | null = null;
  let durationMs: number | null = null;
  let audioClusterId: string | null = null;
  let audioAssetId: string | null = null;
  let canonicalId: string | null = null;
  let isMuted = inheritedMuted;

  for (const record of associatedAudioRecords(anchor)) {
    fastStartUrl ??= getString(record.fast_start_progressive_download_url);
    progressiveUrl ??= getString(record.progressive_download_url);
    reactiveUrl ??= getString(record.reactive_audio_download_url);
    startTimeMs ??= getNonNegativeInteger(
      record.audio_asset_start_time_in_ms,
    );
    durationMs ??= getPositiveInteger(record.overlap_duration_in_ms);
    audioClusterId ??= getId(record.audio_cluster_id);
    audioAssetId ??= getId(record.audio_asset_id);
    canonicalId ??= getId(record.music_canonical_id);
    isMuted ||= isMutedRecord(record);
  }

  const possibleUrl = fastStartUrl ?? progressiveUrl ?? reactiveUrl;
  const postAudioUrl = trustedInstagramCdnUrl(possibleUrl);
  const trackId = audioClusterId ?? audioAssetId;
  if (!postAudioUrl && !trackId && !canonicalId) return null;

  return {
    postAudioUrl,
    postAudioStartTimeMs: postAudioUrl ? (startTimeMs ?? 0) : startTimeMs,
    postAudioDurationMs: durationMs,
    canonicalId,
    isMuted,
    trackId,
  };
}

function inspectAudioTree(root: unknown): AudioCandidate {
  let visitedNodes = 0;
  const seen = new Set<object>();
  const candidates: AudioCandidate[] = [];
  const queue: Array<{
    depth: number;
    inheritedMuted: boolean;
    value: unknown;
  }> = [{
    depth: 0,
    inheritedMuted: false,
    value: root,
  }];

  while (queue.length > 0 && visitedNodes < AUDIO_WALK_MAX_NODES) {
    const current = queue.shift();
    if (!current || current.depth > AUDIO_WALK_MAX_DEPTH) continue;
    const { value } = current;

    if (Array.isArray(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      visitedNodes += 1;
      for (const child of value.slice(0, 100)) {
        queue.push({
          depth: current.depth + 1,
          inheritedMuted: current.inheritedMuted,
          value: child,
        });
      }
      continue;
    }

    const record = getRecord(value);
    if (!record || seen.has(record)) continue;
    seen.add(record);
    visitedNodes += 1;

    const inheritedMuted = current.inheritedMuted || isMutedRecord(record);
    const candidate = candidateFromAnchor(record, inheritedMuted);
    if (candidate) candidates.push(candidate);

    for (const child of Object.values(record).slice(0, 100)) {
      if (child && typeof child === "object") {
        queue.push({
          depth: current.depth + 1,
          inheritedMuted,
          value: child,
        });
      }
    }
  }

  return candidates.find((candidate) =>
    !candidate.isMuted && candidate.postAudioUrl
  ) ??
    candidates.find((candidate) =>
      !candidate.isMuted && (candidate.trackId || candidate.canonicalId)
    ) ?? candidates[0] ?? {
    ...EMPTY_POST_AUDIO,
    canonicalId: null,
    isMuted: false,
    trackId: null,
  };
}

function audioMetadataRoots(media: Record<string, unknown>): unknown[] {
  return [
    media.music_metadata,
    media.clips_metadata,
    media.audio_metadata,
  ].filter((value) => value && typeof value === "object");
}

export function extractPostAudioInfo(
  media: Record<string, unknown>,
): PostAudioInfo {
  const candidate = inspectAudioTree(audioMetadataRoots(media));
  if (candidate.isMuted || !candidate.postAudioUrl) return EMPTY_POST_AUDIO;
  return {
    postAudioUrl: candidate.postAudioUrl,
    postAudioStartTimeMs: candidate.postAudioStartTimeMs ?? 0,
    postAudioDurationMs: candidate.postAudioDurationMs,
  };
}

async function fetchHikerTrack(
  candidate: AudioCandidate,
  apiKey: string,
  fetcher: Fetcher,
): Promise<unknown | null> {
  const requestUrl = candidate.trackId
    ? new URL("https://api.hikerapi.com/v2/track/by/id")
    : candidate.canonicalId
    ? new URL("https://api.hikerapi.com/v2/track/by/canonical/id")
    : null;
  if (!requestUrl) return null;

  if (candidate.trackId) {
    requestUrl.searchParams.set("track_id", candidate.trackId);
  } else {
    requestUrl.searchParams.set("canonical_id", candidate.canonicalId!);
  }
  requestUrl.searchParams.set("safe_int", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIKER_TRACK_TIMEOUT_MS);
  try {
    const response = await fetcher(requestUrl, {
      headers: {
        "Accept": "application/json",
        "x-access-key": apiKey,
      },
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[HikerAudio] track lookup unavailable", {
        status: response.status,
      });
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn("[HikerAudio] track lookup failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolvePostAudio(
  media: Record<string, unknown>,
  apiKey: string,
  fetcher: Fetcher = fetch,
): Promise<ResolvedPostAudioInfo> {
  const sourceCandidate = inspectAudioTree(audioMetadataRoots(media));
  if (sourceCandidate.isMuted) {
    return { ...EMPTY_POST_AUDIO, postAudioLookupStatus: "NONE" };
  }
  if (sourceCandidate.postAudioUrl) {
    return {
      postAudioUrl: sourceCandidate.postAudioUrl,
      postAudioStartTimeMs: sourceCandidate.postAudioStartTimeMs ?? 0,
      postAudioDurationMs: sourceCandidate.postAudioDurationMs,
      postAudioLookupStatus: "FOUND",
    };
  }

  if (!sourceCandidate.trackId && !sourceCandidate.canonicalId) {
    return { ...EMPTY_POST_AUDIO, postAudioLookupStatus: "NONE" };
  }
  const trackResponse = await fetchHikerTrack(sourceCandidate, apiKey, fetcher);
  if (!trackResponse) {
    return { ...EMPTY_POST_AUDIO, postAudioLookupStatus: "RETRYABLE" };
  }
  const resolvedCandidate = inspectAudioTree(trackResponse);
  if (resolvedCandidate.isMuted) {
    return { ...EMPTY_POST_AUDIO, postAudioLookupStatus: "NONE" };
  }
  if (!resolvedCandidate.postAudioUrl) {
    return { ...EMPTY_POST_AUDIO, postAudioLookupStatus: "RETRYABLE" };
  }

  return {
    postAudioUrl: resolvedCandidate.postAudioUrl,
    postAudioStartTimeMs: sourceCandidate.postAudioStartTimeMs ??
      resolvedCandidate.postAudioStartTimeMs ??
      0,
    postAudioDurationMs: sourceCandidate.postAudioDurationMs ??
      resolvedCandidate.postAudioDurationMs,
    postAudioLookupStatus: "FOUND",
  };
}

function bytesMatch(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset < 0 || offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

export function hasMp4AudioTrack(bytes: Uint8Array): boolean {
  for (let index = 0; index <= bytes.length - 16; index += 1) {
    if (
      bytesMatch(bytes, index, "hdlr") && bytesMatch(bytes, index + 12, "soun")
    ) {
      return true;
    }
  }
  return false;
}

async function readVideoRange(
  url: string,
  range: string,
  fetcher: Fetcher,
): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_PROBE_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: { "Range": range },
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get("content-length"));
    if (!Number.isFinite(contentLength) || contentLength > VIDEO_PROBE_BYTES) {
      void response.body?.cancel();
      return null;
    }

    if (response.status === 206) {
      const contentRange = response.headers.get("content-range");
      const match = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/i);
      if (!match) {
        void response.body?.cancel();
        return null;
      }
      const start = Number(match[1]);
      const end = Number(match[2]);
      const total = match[3] === "*" ? null : Number(match[3]);
      const returnedLength = end - start + 1;
      const isHeadRange = range.startsWith("bytes=0-");
      const isSuffixRange = range.startsWith("bytes=-");
      const validHead = isHeadRange && start === 0;
      const validSuffix = isSuffixRange &&
        (total === null || end === total - 1);
      if (
        returnedLength <= 0 ||
        returnedLength > VIDEO_PROBE_BYTES ||
        (!validHead && !validSuffix)
      ) {
        void response.body?.cancel();
        return null;
      }
    } else if (response.status !== 200) {
      void response.body?.cancel();
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > VIDEO_PROBE_BYTES) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function videoUrlHasAudio(
  url: string,
  fetcher: Fetcher,
): Promise<boolean> {
  const head = await readVideoRange(
    url,
    `bytes=0-${VIDEO_PROBE_BYTES - 1}`,
    fetcher,
  );
  if (head && hasMp4AudioTrack(head)) return true;

  const tail = await readVideoRange(
    url,
    `bytes=-${VIDEO_PROBE_BYTES}`,
    fetcher,
  );
  return Boolean(tail && hasMp4AudioTrack(tail));
}

async function preferRecordAudioVariant(
  media: Record<string, unknown>,
  fetcher: Fetcher,
): Promise<Record<string, unknown>> {
  const versions = Array.isArray(media.video_versions)
    ? media.video_versions.filter((value): value is Record<string, unknown> =>
      Boolean(value && typeof value === "object")
    )
    : [];
  if (versions.length < 2) return media;

  const probeCandidates = versions
    .slice(0, VIDEO_PROBE_MAX_CANDIDATES)
    .map((version, index) => ({ index, url: getString(version.url) }))
    .filter((candidate): candidate is { index: number; url: string } =>
      isInstagramCdnUrl(candidate.url)
    );
  if (probeCandidates.length < 2) return media;

  const results = await Promise.all(
    probeCandidates.map(async (candidate) => ({
      ...candidate,
      hasAudio: await videoUrlHasAudio(candidate.url, fetcher),
    })),
  );
  const preferred = results.find((result) => result.hasAudio);
  if (!preferred || preferred.index === 0) return media;

  return {
    ...media,
    video_versions: [
      versions[preferred.index],
      ...versions.filter((_, index) => index !== preferred.index),
    ],
  };
}

export async function preferAudioVideoVersions(
  media: Record<string, unknown>,
  fetcher: Fetcher = fetch,
): Promise<Record<string, unknown>> {
  const preferredRoot = await preferRecordAudioVariant(media, fetcher);
  const carousel = preferredRoot.carousel_media;
  if (!Array.isArray(carousel)) return preferredRoot;

  const preferredCarousel = [...carousel];
  const probeCount = Math.min(
    carousel.length,
    VIDEO_PROBE_MAX_CAROUSEL_RECORDS,
  );
  for (
    let start = 0;
    start < probeCount;
    start += VIDEO_PROBE_RECORD_CONCURRENCY
  ) {
    const end = Math.min(start + VIDEO_PROBE_RECORD_CONCURRENCY, probeCount);
    const batch = await Promise.all(
      carousel.slice(start, end).map((item) => {
        const record = getRecord(item);
        return record ? preferRecordAudioVariant(record, fetcher) : item;
      }),
    );
    preferredCarousel.splice(start, batch.length, ...batch);
  }
  return { ...preferredRoot, carousel_media: preferredCarousel };
}
