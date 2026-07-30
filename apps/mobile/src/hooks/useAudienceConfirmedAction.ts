import { useCallback, useEffect, useRef, useState } from "react";

import { useAudience } from "../audience/AudienceContext";

interface AudienceConfirmedActionOptions {
  ready?: boolean;
  onActionStart?: () => void;
  onConfirmationFailure?: () => void;
  onExecutionError?: (error: unknown) => void;
}

export function useAudienceConfirmedAction<Action>(
  execute: (action: Action) => Promise<void>,
  options?: AudienceConfirmedActionOptions,
) {
  const { policy, selectAgeBand } = useAudience();
  const executeRef = useRef(execute);
  const optionsRef = useRef(options);
  const pendingActionRef = useRef<Action | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [confirming, setConfirming] = useState(false);
  const [pendingActionReady, setPendingActionReady] = useState(false);
  const ready = options?.ready ?? true;

  executeRef.current = execute;
  optionsRef.current = options;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finish = useCallback(() => {
    busyRef.current = false;
    if (mountedRef.current) setConfirming(false);
  }, []);

  const run = useCallback(
    async (action: Action) => {
      if (busyRef.current) return;

      busyRef.current = true;
      setConfirming(true);
      try {
        optionsRef.current?.onActionStart?.();
      } catch (error) {
        finish();
        throw error;
      }

      if (policy.canAuthenticate && ready) {
        try {
          await executeRef.current(action);
        } finally {
          finish();
        }
        return;
      }

      pendingActionRef.current = action;
      if (policy.canAuthenticate) {
        setPendingActionReady(true);
        return;
      }

      setPendingActionReady(false);
      try {
        await selectAgeBand("age14Plus");
        if (mountedRef.current) setPendingActionReady(true);
      } catch (error) {
        optionsRef.current?.onConfirmationFailure?.();
        pendingActionRef.current = null;
        if (mountedRef.current) setPendingActionReady(false);
        finish();
        throw error;
      }
    },
    [finish, policy.canAuthenticate, ready, selectAgeBand],
  );

  useEffect(() => {
    if (
      !policy.canAuthenticate ||
      !ready ||
      !pendingActionReady ||
      pendingActionRef.current === null
    )
      return;

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setPendingActionReady(false);

    void (async () => {
      try {
        await executeRef.current(action);
      } catch (error) {
        optionsRef.current?.onExecutionError?.(error);
      } finally {
        finish();
      }
    })();
  }, [finish, pendingActionReady, policy.canAuthenticate, ready]);

  return { confirming, run };
}
