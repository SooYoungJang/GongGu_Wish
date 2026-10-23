import { useEffect, useRef } from "react";

import { registerForPushNotifications } from "../services/notifications";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  syncNotificationPreferences,
} from "../services/notificationPreferences";

interface BackgroundPushRegistrationOptions {
  accessToken?: string;
  canAuthenticate: boolean;
  authLoading: boolean;
  preferencesReady: boolean;
  pushEnabled: boolean;
  userId?: string;
}

export function useBackgroundPushRegistration({
  accessToken,
  canAuthenticate,
  authLoading,
  preferencesReady,
  pushEnabled,
  userId,
}: BackgroundPushRegistrationOptions): void {
  const canAuthenticateRef = useRef(canAuthenticate);
  canAuthenticateRef.current = canAuthenticate;

  useEffect(() => {
    if (authLoading || !canAuthenticate || !preferencesReady || !pushEnabled || !userId || !accessToken) return;
    let active = true;
    registerForPushNotifications(accessToken, {
      requestPermission: false,
      shouldContinue: () => active && canAuthenticateRef.current,
      onRegistrationCancelled: async () => {
        // Token rotation and unmount only obsolete this attempt. Reset remote
        // preferences solely when the audience actually becomes restricted.
        if (!canAuthenticateRef.current) {
          await syncNotificationPreferences(accessToken, DEFAULT_NOTIFICATION_PREFERENCES);
        }
      },
    }).catch(() => {
      // Registration is best-effort and retried on the next eligible session.
    });
    return () => { active = false; };
  }, [accessToken, canAuthenticate, authLoading, pushEnabled, preferencesReady, userId]);
}
