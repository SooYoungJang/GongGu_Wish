import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePostAudioPlayer } from "../hooks/usePostAudioPlayer";

const audioMock = vi.hoisted(() => ({
  callsAfterRelease: 0,
  deferSeek: false,
  players: [] as any[],
  rejectSeek: null as (() => void) | null,
  resolveSeek: null as (() => void) | null,
  setAudioModeAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-audio", () => ({
  setAudioModeAsync: audioMock.setAudioModeAsync,
  useAudioPlayer: (source: string | null, options?: unknown) => {
    const ReactMock = require("react");
    const currentPlayerRef = ReactMock.useRef(null);
    const playerToReleaseRef = ReactMock.useRef(null);
    const player = ReactMock.useMemo(() => {
      const nativePlayer: any = {
        currentStatus: {
          currentTime: 0,
          duration: 60,
          isLoaded: Boolean(source),
          playbackState: source ? "ready" : "idle",
          playing: false,
        },
        loop: false,
        muted: false,
        options,
        released: false,
        source,
        volume: 1,
      };

      const assertNotReleased = () => {
        if (!nativePlayer.released) return;
        audioMock.callsAfterRelease += 1;
        throw new Error("SharedObjectAlreadyReleasedException: AudioPlayer");
      };
      nativePlayer.pause = vi.fn(() => {
        assertNotReleased();
        nativePlayer.currentStatus.playing = false;
      });
      nativePlayer.play = vi.fn(() => {
        assertNotReleased();
        nativePlayer.currentStatus.playing = true;
      });
      nativePlayer.seekTo = vi.fn(() => {
        assertNotReleased();
        if (!audioMock.deferSeek) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          audioMock.rejectSeek = () =>
            reject(new Error("seek cancelled during release"));
          audioMock.resolveSeek = resolve;
        });
      });
      audioMock.players.push(nativePlayer);
      if (currentPlayerRef.current) {
        playerToReleaseRef.current = currentPlayerRef.current;
      }
      currentPlayerRef.current = nativePlayer;
      return nativePlayer;
    }, [source]);

    // Source changes create a new SharedObject, then release the previous one.
    ReactMock.useEffect(() => {
      if (!playerToReleaseRef.current) return;
      playerToReleaseRef.current.released = true;
      playerToReleaseRef.current = null;
    }, [player]);

    // expo-audio owns and releases hook-created SharedObjects on unmount.
    ReactMock.useEffect(
      () => () => {
        if (currentPlayerRef.current) {
          currentPlayerRef.current.released = true;
        }
      },
      [],
    );

    return player;
  },
  useAudioPlayerStatus: (player: any) => player.currentStatus,
}));

function ReelPostAudioHarness({
  url,
  durationMs = null,
  isActive = true,
  playbackAllowed = isActive,
  renderTick = 0,
}: {
  url: string;
  durationMs?: number | null;
  isActive?: boolean;
  playbackAllowed?: boolean;
  renderTick?: number;
}) {
  void renderTick;
  usePostAudioPlayer({
    url,
    startTimeMs: 0,
    durationMs,
    isActive,
    playbackAllowed,
    muted: false,
  });
  return null;
}

describe("ReelsScreen native player recycling", () => {
  beforeEach(() => {
    audioMock.callsAfterRelease = 0;
    audioMock.deferSeek = false;
    audioMock.players.length = 0;
    audioMock.rejectSeek = null;
    audioMock.resolveSeek = null;
    audioMock.setAudioModeAsync.mockClear();
  });

  it("does not call a released post-audio player when a scrolled-off reel unmounts", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness
          key="reel-a"
          url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a"
        />,
      );
      await Promise.resolve();
    });

    expect(() => {
      act(() => {
        renderer!.update(
          <ReelPostAudioHarness
            key="reel-b"
            url="https://scontent-test.cdninstagram.com/audio/reel-b.m4a"
          />,
        );
      });
    }).not.toThrow();
    expect(audioMock.callsAfterRelease).toBe(0);

    act(() => renderer!.unmount());
    expect(audioMock.callsAfterRelease).toBe(0);
  });

  it("reconfigures the audio session before playing after returning to a reel", async () => {
    const url = "https://scontent-test.cdninstagram.com/audio/resume.m4a";
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness playbackAllowed isActive url={url} />,
      );
      await Promise.resolve();
    });

    const player = audioMock.players[0];
    expect(player.play).toHaveBeenCalled();
    audioMock.setAudioModeAsync.mockClear();
    player.play.mockClear();

    await act(async () => {
      renderer!.update(
        <ReelPostAudioHarness
          isActive={false}
          playbackAllowed={false}
          url={url}
        />,
      );
      await Promise.resolve();
    });
    expect(player.pause).toHaveBeenCalled();

    let resolveAudioMode: (() => void) | undefined;
    audioMock.setAudioModeAsync.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveAudioMode = () => resolve(undefined);
        }),
    );

    await act(async () => {
      renderer!.update(
        <ReelPostAudioHarness playbackAllowed isActive url={url} />,
      );
      await Promise.resolve();
    });

    expect(audioMock.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();

    await act(async () => {
      resolveAudioMode?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(player.play).toHaveBeenCalled();

    act(() => renderer!.unmount());
  });

  it("ignores a pending seek rejection after the reel audio player is released", async () => {
    audioMock.deferSeek = true;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a" />,
      );
      await Promise.resolve();
    });

    expect(audioMock.rejectSeek).not.toBeNull();
    expect(() => {
      act(() => renderer!.unmount());
    }).not.toThrow();

    await act(async () => {
      audioMock.rejectSeek?.();
      await Promise.resolve();
    });
    expect(audioMock.callsAfterRelease).toBe(0);
  });

  it("ignores a pending seek from a replaced source without unmounting", async () => {
    audioMock.deferSeek = true;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a" />,
      );
      await Promise.resolve();
    });

    const previousPlayer = audioMock.players[0];
    const resolvePreviousSeek = audioMock.resolveSeek;
    expect(resolvePreviousSeek).not.toBeNull();

    audioMock.deferSeek = false;
    await act(async () => {
      renderer!.update(
        <ReelPostAudioHarness url="https://scontent-test.cdninstagram.com/audio/reel-b.m4a" />,
      );
      await Promise.resolve();
    });

    expect(audioMock.players).toHaveLength(2);
    expect(previousPlayer.released).toBe(true);
    await act(async () => {
      resolvePreviousSeek?.();
      await Promise.resolve();
    });
    expect(previousPlayer.play).not.toHaveBeenCalled();
    expect(audioMock.callsAfterRelease).toBe(0);

    act(() => renderer!.unmount());
  });

  it("ignores a segment-loop seek completion after release", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness
          durationMs={1_000}
          renderTick={0}
          url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a"
        />,
      );
      await Promise.resolve();
    });

    const player = audioMock.players[0];
    audioMock.deferSeek = true;
    player.currentStatus.currentTime = 1;
    await act(async () => {
      renderer!.update(
        <ReelPostAudioHarness
          durationMs={1_000}
          renderTick={1}
          url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a"
        />,
      );
      await Promise.resolve();
    });

    const resolveLoopSeek = audioMock.resolveSeek;
    expect(resolveLoopSeek).not.toBeNull();
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());

    await act(async () => {
      resolveLoopSeek?.();
      await Promise.resolve();
    });
    expect(audioMock.callsAfterRelease).toBe(0);
  });
});
