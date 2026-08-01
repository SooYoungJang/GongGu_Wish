import { AppState, type AppStateStatus } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { syncSupabaseAuthAutoRefresh } from "../lib/supabase";
import { flushPopularitySignalOutbox } from "./popularitySignalOutbox";

export function startPopularitySignalRecovery(): () => void {
  let disposed = false;

  const flushIfActive = () => {
    if (disposed || AppState.currentState !== "active") return;
    void flushPopularitySignalOutbox().catch(() => undefined);
  };

  const syncRuntime = (status: AppStateStatus) => {
    void syncSupabaseAuthAutoRefresh(status)
      .then(() => {
        if (!disposed && status === "active") flushIfActive();
      })
      .catch((error) => {
        console.warn({
          event: "supabase_auth_refresh_lifecycle_failed",
          errorName: error instanceof Error ? error.name : typeof error,
        });
      });
  };

  syncRuntime(AppState.currentState);
  const appStateSubscription = AppState.addEventListener("change", syncRuntime);
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    if (online) syncRuntime(AppState.currentState);
  });

  return () => {
    disposed = true;
    appStateSubscription.remove();
    unsubscribeOnline();
  };
}
