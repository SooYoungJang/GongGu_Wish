import { useEffect } from "react";

import { useAudience } from "../audience/AudienceContext";
import { useAuth } from "../context/AuthContext";
import { startUserAppAccessTracking } from "../services/userAppAccess";

export function UserActivityBridge() {
  const { user, session, isLoading } = useAuth();
  const { policy } = useAudience();
  const userId = user?.id;
  const accessToken = session?.access_token;
  const canRecord = policy.canAuthenticate && policy.canRecordBehaviorSignals;

  useEffect(() => {
    if (isLoading || !canRecord || !userId || !accessToken) return;
    return startUserAppAccessTracking(userId);
  }, [isLoading, canRecord, userId, accessToken]);

  return null;
}
