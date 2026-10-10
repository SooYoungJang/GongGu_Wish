import { useSyncExternalStore } from "react";

// Keep the user's sound choice for the app session, across reel pages and
// detail routes. Only the two feed screens subscribe, not individual players.
let muted = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return muted;
}

function getServerSnapshot() {
  return false;
}

function setMuted(nextMuted: boolean) {
  if (muted === nextMuted) return;
  muted = nextMuted;
  listeners.forEach((listener) => listener());
}

export function useMediaMutePreference() {
  const isMuted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { muted: isMuted, setMuted };
}
