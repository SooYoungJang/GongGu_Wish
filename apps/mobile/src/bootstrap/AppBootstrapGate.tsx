import React, { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import {
  HOME_BOOTSTRAP_TIMEOUT_MS,
  prefetchHomeBootstrap,
} from "./appBootstrap";

type AppBootstrapGateProps = {
  children: React.ReactNode;
  prefetch?: typeof prefetchHomeBootstrap;
  timeoutMs?: number;
};

export function AppBootstrapGate({
  children,
  prefetch = prefetchHomeBootstrap,
  timeoutMs = HOME_BOOTSTRAP_TIMEOUT_MS,
}: AppBootstrapGateProps) {
  const { isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (authLoading || isReady) return;

    let active = true;
    const release = () => {
      if (active) setIsReady(true);
    };
    const timeout = setTimeout(release, timeoutMs);

    void Promise.resolve()
      .then(() => prefetch(queryClient))
      .then(release, release)
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [authLoading, isReady, prefetch, queryClient, timeoutMs]);

  useEffect(() => {
    if (!isReady) return;
    void SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

  if (!isReady) return null;
  return <>{children}</>;
}
