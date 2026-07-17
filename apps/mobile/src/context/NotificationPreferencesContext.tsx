import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  clearPendingNotificationPreferences,
  loadNotificationPreferences,
  loadPendingNotificationPreferences,
  loadRemoteNotificationPreferences,
  normalizeNotificationPreferences,
  saveNotificationPreferences,
  savePendingNotificationPreferences,
  syncNotificationPreferences,
  type NotificationPreferences,
} from "../services/notificationPreferences";

type NotificationPreferencesPatch = Partial<NotificationPreferences>;

export type NotificationPreferencesContextValue = {
  preferences: NotificationPreferences;
  ready: boolean;
  saving: boolean;
  error: Error | null;
  updatePreferences(
    patch: NotificationPreferencesPatch,
  ): Promise<NotificationPreferences>;
  toggleInfluencer(value: string): Promise<NotificationPreferences>;
  toggleBrand(value: string): Promise<NotificationPreferences>;
};

const defaultValue: NotificationPreferencesContextValue = {
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  ready: true,
  saving: false,
  error: null,
  updatePreferences: async (patch) =>
    normalizeNotificationPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...patch,
    }),
  toggleInfluencer: async () => DEFAULT_NOTIFICATION_PREFERENCES,
  toggleBrand: async () => DEFAULT_NOTIFICATION_PREFERENCES,
};

const NotificationPreferencesContext =
  createContext<NotificationPreferencesContextValue>(defaultValue);

export function NotificationPreferencesProvider({
  authToken,
  children,
  namespace,
}: {
  authToken?: string | null;
  children: ReactNode;
  namespace: string;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const preferencesRef = useRef(preferences);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadGeneration = useRef(0);
  const editRevision = useRef(0);
  const saveGeneration = useRef(0);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const generation = ++loadGeneration.current;
    const revision = editRevision.current;
    saveGeneration.current += 1;
    persistenceQueue.current = Promise.resolve();
    setReady(false);
    setSaving(false);
    setError(null);
    const defaults = normalizeNotificationPreferences(null);
    preferencesRef.current = defaults;
    setPreferences(defaults);

    void (async () => {
      const local = await loadNotificationPreferences(namespace);
      let loaded = local;
      if (authToken) {
        const pending = await loadPendingNotificationPreferences(namespace);
        try {
          if (pending) {
            loaded = pending;
            await syncNotificationPreferences(authToken, pending);
            await saveNotificationPreferences(namespace, pending);
            await clearPendingNotificationPreferences(namespace);
          } else {
            loaded = await loadRemoteNotificationPreferences(authToken);
            await saveNotificationPreferences(namespace, loaded);
          }
        } catch (cause) {
          if (pending) loaded = pending;
          if (loadGeneration.current === generation) {
            setError(
              cause instanceof Error
                ? cause
                : new Error("알림 설정을 동기화하지 못했습니다."),
            );
          }
        }
      }
      if (
        loadGeneration.current !== generation ||
        editRevision.current !== revision
      )
        return;
      preferencesRef.current = loaded;
      setPreferences(loaded);
    })().finally(() => {
      if (loadGeneration.current === generation) setReady(true);
    });
  }, [authToken, namespace]);

  const updatePreferences = useCallback(
    async (patch: NotificationPreferencesPatch) => {
      const next = normalizeNotificationPreferences({
        ...preferencesRef.current,
        ...patch,
      });
      editRevision.current += 1;
      preferencesRef.current = next;
      setPreferences(next);
      const generation = ++saveGeneration.current;
      setSaving(true);
      setError(null);
      const persist = persistenceQueue.current
        .catch(() => undefined)
        .then(async () => {
          let localFailure: unknown = null;
          try {
            await saveNotificationPreferences(namespace, next);
          } catch (cause) {
            localFailure = cause;
          }
          if (authToken) {
            try {
              await savePendingNotificationPreferences(namespace, next);
            } catch (cause) {
              localFailure ??= cause;
            }
            await syncNotificationPreferences(authToken, next);
            await clearPendingNotificationPreferences(namespace);
          }
          if (localFailure) throw localFailure;
        });
      persistenceQueue.current = persist;
      try {
        await persist;
      } catch (cause) {
        if (saveGeneration.current === generation) {
          setError(
            cause instanceof Error
              ? cause
              : new Error("알림 설정을 저장하지 못했습니다."),
          );
        }
      } finally {
        if (saveGeneration.current === generation) setSaving(false);
      }
      return next;
    },
    [authToken, namespace],
  );

  const toggleTarget = useCallback(
    async (kind: "brand" | "influencer", value: string) => {
      const key =
        kind === "influencer" ? "followedInfluencers" : "followedBrands";
      const normalizedCandidate = normalizeNotificationPreferences({
        [key]: [value],
      })[key][0];
      if (!normalizedCandidate) return preferencesRef.current;

      const identity = normalizedCandidate.toLocaleLowerCase("en-US");
      const current = preferencesRef.current[key];
      const exists = current.some(
        (target) => target.toLocaleLowerCase("en-US") === identity,
      );
      return updatePreferences({
        [key]: exists
          ? current.filter(
              (target) => target.toLocaleLowerCase("en-US") !== identity,
            )
          : [...current, normalizedCandidate],
      });
    },
    [updatePreferences],
  );

  const toggleInfluencer = useCallback(
    (value: string) => toggleTarget("influencer", value),
    [toggleTarget],
  );
  const toggleBrand = useCallback(
    (value: string) => toggleTarget("brand", value),
    [toggleTarget],
  );

  const contextValue = useMemo<NotificationPreferencesContextValue>(
    () => ({
      preferences,
      ready,
      saving,
      error,
      updatePreferences,
      toggleInfluencer,
      toggleBrand,
    }),
    [
      error,
      preferences,
      ready,
      saving,
      toggleBrand,
      toggleInfluencer,
      updatePreferences,
    ],
  );

  return (
    <NotificationPreferencesContext.Provider value={contextValue}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  return useContext(NotificationPreferencesContext);
}
