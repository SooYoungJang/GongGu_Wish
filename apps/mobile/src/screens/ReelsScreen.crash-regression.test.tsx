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
}));

vi.mock("expo-audio", () => ({
  setAudioModeAsync: vi.fn(async () => undefined),
  useAudioPlayer: (source: string | null, options?: unknown) => {
    const ReactMock = require("react");
    const [player] = ReactMock.useState(() => {
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
      return nativePlayer;
    });

    // expo-audio owns and releases hook-created SharedObjects on unmount.
    ReactMock.useEffect(
      () => () => {
        player.released = true;
      },
      [player],
    );

    return player;
  },
  useAudioPlayerStatus: (player: any) => player.currentStatus,
}));

function ReelPostAudioHarness({ url }: { url: string }) {
  usePostAudioPlayer({
    url,
    startTimeMs: 0,
    durationMs: null,
    isActive: true,
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

  it("ignores a pending seek rejection after the reel audio player is released", async () => {
    audioMock.deferSeek = true;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ReelPostAudioHarness
          url="https://scontent-test.cdninstagram.com/audio/reel-a.m4a"
        />,
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
});
