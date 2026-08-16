import { useEffect, useMemo, useRef } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

type UsePostAudioPlayerOptions = {
  url?: string | null;
  startTimeMs?: number | null;
  durationMs?: number | null;
  isActive: boolean;
  playbackAllowed?: boolean;
  muted: boolean;
  replayKey?: number;
};

type PostAudioPlayerState = {
  hasError: boolean;
  isPlaying: boolean;
  isReady: boolean;
};

const AUDIO_STATUS_UPDATE_INTERVAL_MS = 250;
const SEGMENT_BOUNDARY_TOLERANCE_SECONDS = 0.05;

function toNonNegativeSeconds(valueMs?: number | null) {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs)) return 0;
  return Math.max(0, valueMs / 1000);
}

function toPositiveSeconds(valueMs?: number | null) {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs) || valueMs <= 0) {
    return null;
  }
  return valueMs / 1000;
}

function isFailedPlaybackState(playbackState?: string) {
  const normalized = playbackState?.toLocaleLowerCase("en-US") ?? "";
  return normalized === "error" || normalized === "failed";
}

export function usePostAudioPlayer({
  url,
  startTimeMs,
  durationMs,
  isActive,
  playbackAllowed = isActive,
  muted,
  replayKey,
}: UsePostAudioPlayerOptions): PostAudioPlayerState {
  const source = url?.trim() || null;
  const player = useAudioPlayer(source, {
    updateInterval: AUDIO_STATUS_UPDATE_INTERVAL_MS,
  });
  const status = useAudioPlayerStatus(player);
  const startTimeSeconds = toNonNegativeSeconds(startTimeMs);
  const durationSeconds = toPositiveSeconds(durationMs);
  const playbackKey = useMemo(
    () => `${source ?? ""}:${startTimeSeconds}:${durationSeconds ?? "end"}:${replayKey ?? 0}`,
    [durationSeconds, replayKey, source, startTimeSeconds],
  );
  const shouldPlayRef = useRef(isActive && playbackAllowed);
  const initializedPlaybackKeyRef = useRef<string | null>(null);
  const playbackRequestIdRef = useRef(0);
  const segmentLoopInFlightRef = useRef(false);
  shouldPlayRef.current = isActive && playbackAllowed;

  const hasError = Boolean(
    source && isFailedPlaybackState(status.playbackState),
  );
  const isReady = Boolean(source && status.isLoaded && !hasError);

  useEffect(() => {
    if (!source) return;

    void setAudioModeAsync({
      interruptionMode: "mixWithOthers",
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      console.warn("게시물 음악 재생 모드를 설정하지 못했습니다.");
    });
  }, [source]);

  useEffect(() => {
    player.muted = muted;
    player.volume = 1;
    player.loop = startTimeSeconds === 0 && durationSeconds === null;
  }, [durationSeconds, muted, player, startTimeSeconds]);

  useEffect(() => {
    const requestId = playbackRequestIdRef.current + 1;
    playbackRequestIdRef.current = requestId;

    if (!source || hasError) {
      initializedPlaybackKeyRef.current = null;
      player.pause();
      return;
    }

    if (!isActive) {
      initializedPlaybackKeyRef.current = null;
      player.pause();
      return;
    }

    if (!playbackAllowed) {
      player.pause();
      return;
    }

    if (!status.isLoaded) {
      initializedPlaybackKeyRef.current = null;
      return;
    }
    if (initializedPlaybackKeyRef.current === playbackKey) {
      player.play();
      return;
    }

    // Do not let audio from the previous playback epoch advance while the
    // asynchronous seek aligns a new source, segment, or replay.
    player.pause();
    const playFromSegmentStart = async () => {
      try {
        await player.seekTo(startTimeSeconds);
        if (
          playbackRequestIdRef.current === requestId &&
          shouldPlayRef.current
        ) {
          initializedPlaybackKeyRef.current = playbackKey;
          player.play();
        }
      } catch {
        if (
          playbackRequestIdRef.current !== requestId ||
          !shouldPlayRef.current
        ) {
          return;
        }
        initializedPlaybackKeyRef.current = null;
        player.pause();
      }
    };

    void playFromSegmentStart();
  }, [
    hasError,
    isActive,
    playbackAllowed,
    playbackKey,
    player,
    source,
    startTimeSeconds,
    status.isLoaded,
  ]);

  useEffect(() => {
    if (
      !isActive ||
      !playbackAllowed ||
      !isReady ||
      segmentLoopInFlightRef.current
    )
      return;

    const requestId = playbackRequestIdRef.current;

    const segmentEndSeconds = durationSeconds
      ? startTimeSeconds + durationSeconds
      : startTimeSeconds > 0 && status.duration > startTimeSeconds
        ? status.duration
        : null;
    if (
      segmentEndSeconds === null ||
      status.currentTime <
        segmentEndSeconds - SEGMENT_BOUNDARY_TOLERANCE_SECONDS
    ) {
      return;
    }

    segmentLoopInFlightRef.current = true;
    void player
      .seekTo(startTimeSeconds)
      .then(() => {
        if (
          shouldPlayRef.current &&
          playbackRequestIdRef.current === requestId
        ) {
          player.play();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        segmentLoopInFlightRef.current = false;
      });
  }, [
    durationSeconds,
    isActive,
    isReady,
    playbackAllowed,
    player,
    startTimeSeconds,
    status.currentTime,
    status.duration,
  ]);

  useEffect(
    () => () => {
      shouldPlayRef.current = false;
      playbackRequestIdRef.current += 1;
    },
    [],
  );

  return {
    hasError,
    isPlaying: isReady && isActive && playbackAllowed && status.playing,
    isReady,
  };
}
