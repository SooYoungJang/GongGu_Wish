import { useRef, useCallback, useState } from "react";

/**
 * Synchronous useRef-based submission guard hook.
 *
 * Prevents duplicate submissions by using a ref (synchronous, no state delay)
 * as the dedup mechanism. The `isDispatched` state is only for UI feedback
 * (button disabled state), while `guard()` provides the actual race-condition
 * protection.
 *
 * Usage:
 *   const { isDispatched, guard, reset } = useSubmissionGuard();
 *
 *   async function handleSubmit() {
 *     if (!guard()) return;        // <- synchronous dedup
 *     try {
 *       await api.post(...);
 *     } finally {
 *       reset();                    // <- release guard
 *     }
 *   }
 *
 *   <button disabled={isDispatched}>Submit</button>
 */
export function useSubmissionGuard(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const dispatchingRef = useRef(false);
  const [isDispatched, setIsDispatched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guard = useCallback(() => {
    if (dispatchingRef.current) return false;
    dispatchingRef.current = true;
    setIsDispatched(true);

    // Safety auto-reset — releases the lock if finally doesn't run
    // (e.g. component unmounts during the request)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dispatchingRef.current = false;
      setIsDispatched(false);
    }, timeoutMs);

    return true;
  }, [timeoutMs]);

  const reset = useCallback(() => {
    dispatchingRef.current = false;
    setIsDispatched(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { isDispatched, guard, reset };
}
