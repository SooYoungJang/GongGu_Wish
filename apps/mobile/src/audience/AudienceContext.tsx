import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  parseStoredAgeBand,
  requiresRestrictedModeCleanup,
  resolveAudiencePolicy,
  type AgeBand,
  type AudiencePolicy,
} from "./audiencePolicy";
import { setAudiencePolicySnapshot } from "./behaviorSignalsPolicy";

export const AGE_BAND_STORAGE_KEY = "@gonggu/audience/age-band/v1";

type RestrictedModeCleanup = () => void | Promise<void>;

export type AudienceContextValue = {
  ageBand: AgeBand | null;
  isHydrated: boolean;
  policy: AudiencePolicy;
  selectAgeBand: (_ageBand: AgeBand) => Promise<void>;
  clearAgeBand: () => Promise<void>;
  registerRestrictedModeCleanup: (
    _cleanup: RestrictedModeCleanup,
  ) => () => void;
};

const AudienceContext = createContext<AudienceContextValue | null>(null);

export function AudienceProvider({
  children,
  initialAgeBandOverride = null,
}: {
  children: React.ReactNode;
  initialAgeBandOverride?: AgeBand | null;
}) {
  const [ageBand, setAgeBand] = useState<AgeBand | null>(() => {
    setAudiencePolicySnapshot(resolveAudiencePolicy(initialAgeBandOverride));
    return initialAgeBandOverride;
  });
  const [isHydrated, setIsHydrated] = useState(initialAgeBandOverride !== null);
  const ageBandRef = useRef<AgeBand | null>(initialAgeBandOverride);
  const restrictedModeCleanupRef = useRef<RestrictedModeCleanup | null>(null);
  const selectionRevisionRef = useRef(0);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (initialAgeBandOverride) return;
    let mounted = true;
    const hydrationRevision = selectionRevisionRef.current;
    AsyncStorage.getItem(AGE_BAND_STORAGE_KEY)
      .then((storedValue) => {
        if (!mounted || hydrationRevision !== selectionRevisionRef.current)
          return;
        const parsed = parseStoredAgeBand(storedValue);
        ageBandRef.current = parsed;
        setAudiencePolicySnapshot(resolveAudiencePolicy(parsed));
        setAgeBand(parsed);
      })
      .catch(() => {
        if (!mounted || hydrationRevision !== selectionRevisionRef.current)
          return;
        ageBandRef.current = null;
        setAudiencePolicySnapshot(resolveAudiencePolicy(null));
        setAgeBand(null);
      })
      .finally(() => {
        if (mounted) setIsHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, [initialAgeBandOverride]);

  const registerRestrictedModeCleanup = useCallback(
    (cleanup: RestrictedModeCleanup) => {
      restrictedModeCleanupRef.current = cleanup;
      return () => {
        if (restrictedModeCleanupRef.current === cleanup) {
          restrictedModeCleanupRef.current = null;
        }
      };
    },
    [],
  );

  const selectAgeBand = useCallback(async (nextAgeBand: AgeBand) => {
    const revision = ++selectionRevisionRef.current;
    const previousAgeBand = ageBandRef.current;
    const requiresCleanup = requiresRestrictedModeCleanup(
      previousAgeBand,
      nextAgeBand,
    );
    const unlocksAudienceFeatures = nextAgeBand === "age14Plus";
    if (!unlocksAudienceFeatures) {
      ageBandRef.current = nextAgeBand;
      setAudiencePolicySnapshot(resolveAudiencePolicy(nextAgeBand));
      setAgeBand(nextAgeBand);
    }

    const persistSelection = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (revision !== selectionRevisionRef.current) return;
        if (requiresCleanup) {
          await AsyncStorage.removeItem(AGE_BAND_STORAGE_KEY).catch(() => {});
        }
        if (revision !== selectionRevisionRef.current) return;
        try {
          await AsyncStorage.setItem(AGE_BAND_STORAGE_KEY, nextAgeBand);
        } catch (error) {
          if (revision !== selectionRevisionRef.current) return;
          await AsyncStorage.removeItem(AGE_BAND_STORAGE_KEY).catch(() => {});
          if (unlocksAudienceFeatures) throw error;
          return;
        }
        if (
          unlocksAudienceFeatures &&
          revision === selectionRevisionRef.current
        ) {
          ageBandRef.current = nextAgeBand;
          setAudiencePolicySnapshot(resolveAudiencePolicy(nextAgeBand));
          setAgeBand(nextAgeBand);
        }
      });
    persistenceQueueRef.current = persistSelection.catch(() => undefined);
    const operations: Promise<unknown>[] = [persistSelection];
    if (requiresCleanup) {
      operations.push(
        Promise.resolve(restrictedModeCleanupRef.current?.()).catch(() => {
          // The policy state is already restricted. Cleanup is best-effort and
          // can be retried by the authentication boundary on its next mount.
        }),
      );
    }
    const [persistenceResult] = await Promise.allSettled(operations);
    if (persistenceResult?.status === "rejected") {
      throw persistenceResult.reason;
    }
  }, []);

  const clearAgeBand = useCallback(async () => {
    const revision = ++selectionRevisionRef.current;
    const previousAgeBand = ageBandRef.current;
    ageBandRef.current = null;
    setAudiencePolicySnapshot(resolveAudiencePolicy(null));
    setAgeBand(null);
    const removeSelection = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (revision !== selectionRevisionRef.current) return;
        await AsyncStorage.removeItem(AGE_BAND_STORAGE_KEY);
      });
    persistenceQueueRef.current = removeSelection.catch(() => undefined);
    const operations: Promise<unknown>[] = [removeSelection];
    if (previousAgeBand === "age14Plus") {
      operations.push(
        Promise.resolve(restrictedModeCleanupRef.current?.()).catch(() => {}),
      );
    }
    await Promise.allSettled(operations);
  }, []);

  const policy = useMemo(() => resolveAudiencePolicy(ageBand), [ageBand]);
  const value = useMemo<AudienceContextValue>(
    () => ({
      ageBand,
      isHydrated,
      policy,
      selectAgeBand,
      clearAgeBand,
      registerRestrictedModeCleanup,
    }),
    [
      ageBand,
      clearAgeBand,
      isHydrated,
      policy,
      registerRestrictedModeCleanup,
      selectAgeBand,
    ],
  );

  return (
    <AudienceContext.Provider value={value}>
      {children}
    </AudienceContext.Provider>
  );
}

export function useAudience(): AudienceContextValue {
  const value = useContext(AudienceContext);
  if (!value) {
    throw new Error("useAudience must be used within AudienceProvider");
  }
  return value;
}
