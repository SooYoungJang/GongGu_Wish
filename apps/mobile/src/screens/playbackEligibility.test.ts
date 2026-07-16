import { describe, expect, it } from "vitest";

import {
  DEEP_VIEW_THRESHOLD_MS,
  isPlaybackEligible,
} from "./playbackEligibility";

const playingVideo = {
  screenFocused: true,
  appActive: true,
  overlayOpen: false,
  playerPlaying: true,
  hasPlayableMedia: true,
};

describe("isPlaybackEligible", () => {
  it("uses the shared ten-second deep-view threshold", () => {
    expect(DEEP_VIEW_THRESHOLD_MS).toBe(10_000);
  });

  it("allows continuous playback tracking when every gate is open", () => {
    expect(isPlaybackEligible(playingVideo)).toBe(true);
  });

  it.each([
    ["screen is blurred", { screenFocused: false }],
    ["app is backgrounded", { appActive: false }],
    ["a sheet is open", { overlayOpen: true }],
    ["player is paused", { playerPlaying: false }],
    ["item has no video", { hasPlayableMedia: false }],
  ])("blocks tracking when %s", (_reason, override) => {
    expect(isPlaybackEligible({ ...playingVideo, ...override })).toBe(false);
  });
});
