export type PlaybackEligibilityInput = {
  screenFocused: boolean;
  appActive: boolean;
  overlayOpen: boolean;
  playerPlaying: boolean;
  hasPlayableMedia: boolean;
};

export function isPlaybackEligible({
  screenFocused,
  appActive,
  overlayOpen,
  playerPlaying,
  hasPlayableMedia,
}: PlaybackEligibilityInput) {
  return (
    screenFocused &&
    appActive &&
    !overlayOpen &&
    playerPlaying &&
    hasPlayableMedia
  );
}
