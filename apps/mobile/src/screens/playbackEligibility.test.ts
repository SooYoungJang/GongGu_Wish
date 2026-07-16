import { describe, expect, it } from "vitest";

import { isPlaybackEligible } from "./playbackEligibility";

const playingVideo = {
  screenFocused: true,
  appActive: true,
  overlayOpen: false,
  playerPlaying: true,
  hasPlayableMedia: true,
};

describe("isPlaybackEligible", () => {
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
