import { onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

import { postgrestPost } from "../lib/postgrest-client";

/** Keep one server timestamp per account; never attach identity to diagnostics. */
export function startUserAppAccessTracking(userId: string): () => void {
  let disposed = false;
  let state = AppState.currentState;
  let pending: AbortController | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    pending?.abort();
    pending = null;
    clearTimeout(timeout);
    timeout = undefined;
  };
  const record = () => {
    if (disposed || state !== "active" || !onlineManager.isOnline() || pending) return;
    const controller = new AbortController();
    pending = controller;
    timeout = setTimeout(cancel, 15_000);
    void postgrestPost<void>(
      "rpc/record_user_app_access",
      { p_expected_user_id: userId },
      { expectedUserId: userId, signal: controller.signal },
    ).catch(() => {
      if (!controller.signal.aborted) {
        console.warn("[UserAppAccess] Recent access could not be recorded");
      }
    }).finally(() => {
      if (pending === controller) {
        pending = null;
        clearTimeout(timeout);
        timeout = undefined;
      }
    });
  };

  const subscription = AppState.addEventListener("change", nextState => {
    const previous = state;
    state = nextState;
    if (state !== "active") cancel();
    else if (previous !== "active") record();
  });
  const unsubscribe = onlineManager.subscribe(online => { if (online) record(); });
  record();

  return () => {
    disposed = true;
    cancel();
    subscription.remove();
    unsubscribe();
  };
}
