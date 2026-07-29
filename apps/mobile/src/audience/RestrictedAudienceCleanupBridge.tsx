import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "../context/AuthContext";
import { clearLocalUserData } from "../hooks/useLocalDeals";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  syncNotificationPreferences,
} from "../services/notificationPreferences";
import { getAuthToken } from "../utils/auth";
import { clearSessionId } from "../utils/session";
import { useAudience } from "./AudienceContext";
import { cleanupRestrictedAudienceSession } from "./restrictedAudienceCleanup";

export function RestrictedAudienceCleanupBridge() {
  const { policy, registerRestrictedModeCleanup } = useAudience();
  const { session, signOut, user } = useAuth();
  const cleanupPromiseRef = useRef<Promise<void> | null>(null);

  const runCleanup = useCallback(() => {
    if (cleanupPromiseRef.current) return cleanupPromiseRef.current;

    const cleanupPromise = (async () => {
      const accessToken = session?.access_token ?? (await getAuthToken());
      await cleanupRestrictedAudienceSession({
        accessToken,
        userId: user?.id,
        disableRemotePush: (token) =>
          syncNotificationPreferences(token, DEFAULT_NOTIFICATION_PREFERENCES),
        signOut,
        clearSessionId,
        clearLocalUserData,
      });
    })();
    cleanupPromiseRef.current = cleanupPromise;
    return cleanupPromise;
  }, [session?.access_token, signOut, user?.id]);

  useEffect(
    () => registerRestrictedModeCleanup(runCleanup),
    [registerRestrictedModeCleanup, runCleanup],
  );

  useEffect(() => {
    if (policy.canAuthenticate) {
      cleanupPromiseRef.current = null;
      return;
    }
    if (policy.resolved) void runCleanup();
  }, [policy.canAuthenticate, policy.resolved, runCleanup]);

  return null;
}
