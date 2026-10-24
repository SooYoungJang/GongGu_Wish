import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Linking } from "react-native";

import type { AudiencePolicy } from "../audience/audiencePolicy";
import { AUTH_REDIRECT_URL } from "../lib/auth-config";
import { createSupabaseAuthRequestClient, discardSupabaseAuthSession, getSupabase } from "../lib/supabase";
import { setAuthToken, clearAuthToken } from "../utils/auth";
import type { SocialAuthProvider } from "../utils/authHelpers";
import { signOutPushDevice } from "../services/pushDeviceSession";
import { signOutLocalNotifications } from "../services/localNotificationSession";

export const EMAIL_CODE_TTL_SECONDS = 5 * 60;
const OAUTH_ATTEMPT_STORAGE_KEY = "gonggu.oauth-attempt.v1";
const OAUTH_ATTEMPT_TTL_MS = 15 * 60 * 1000;

type OAuthAttempt = {
  createdAt: number;
  id: string;
  provider: SocialAuthProvider;
};

type OAuthCallbackResult =
  | { handled: false; error: null }
  | { handled: true; error: AuthError | null };

export type AuthContinuation = () => void | Promise<void>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** Current authenticated user, or null if not logged in */
  user: User | null;
  /** Current Supabase session, or null if not logged in */
  session: Session | null;
  /** True while restoring session on mount */
  isLoading: boolean;
  /** True while the currently selected auth flow owns session changes. */
  isAudienceAuthIntentPending: boolean;
  /** Increments only when an explicit auth attempt applies its own session. */
  authCompletionRevision: number;
  /** Store a user action to resume after a successful login. */
  setAuthContinuation: (continuation: AuthContinuation | null) => void;
  /** Take and clear the action that is waiting for successful login. */
  takeAuthContinuation: () => AuthContinuation | null;
  /** Clear a pending action when the login screen is dismissed. */
  clearAuthContinuation: () => void;
  /** Login with email and password */
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  /** Sign up with email, password, and optional metadata (nickname, etc.) */
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  /** Send a signup confirmation code to the user's email */
  signUpWithEmailCode: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) => Promise<AuthError | null>;
  /** Resend a signup confirmation code to the user's email */
  resendEmailSignUpCode: (email: string) => Promise<AuthError | null>;
  /** Verify the email confirmation code entered in-app */
  verifyEmailCode: (email: string, token: string) => Promise<AuthError | null>;
  /** Sign up with additional user metadata (nickname, etc.) */
  signUpWithMetadata: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) => Promise<AuthError | null>;
  /** Sign in/up with OAuth provider (Kakao, Naver custom provider, Apple) */
  signInWithOAuth: (provider: SocialAuthProvider) => Promise<AuthError | null>;
  /** Skip a stale local session restore while a newly confirmed auth action starts. */
  startAudienceAuthIntent: () => void;
  /** Cancel a pending auth intent when age confirmation cannot be persisted. */
  cancelAudienceAuthIntent: () => void;
  /** Log out the current user */
  signOut: (options?: { accountDeleted?: boolean }) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

function createAudienceRestrictedAuthError(): AuthError {
  return {
    name: "AudienceRestrictedError",
    message: "로그인과 회원가입은 만 14세 이상부터 이용할 수 있어요.",
    status: 403,
  } as AuthError;
}

function createOAuthCallbackError(url?: string): AuthError {
  let message = "소셜 로그인 완료 정보를 확인하지 못했습니다.";
  if (url) {
    try {
      const parsed = new URL(url);
      message =
        parsed.searchParams.get("error_description") ??
        parsed.searchParams.get("error") ??
        message;
    } catch {
      // Keep the user-safe fallback for malformed callback URLs.
    }
  }
  return {
    name: "OAuthCallbackError",
    message,
    status: 400,
  } as AuthError;
}

function createMissingAuthSessionError(): AuthError {
  return {
    name: "MissingAuthSessionError",
    message: "로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.",
    status: 500,
  } as AuthError;
}

function createCancelledAuthRequestError(): AuthError {
  return {
    name: "AuthRequestCancelledError",
    message: "취소된 로그인 요청입니다. 다시 시도해주세요.",
    status: 400,
  } as AuthError;
}

function getAuthCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const searchCode = parsed.searchParams.get("code");
    if (searchCode) return searchCode;

    const hash = parsed.hash.startsWith("#")
      ? parsed.hash.slice(1)
      : parsed.hash;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get("code");
  } catch {
    const [, query = ""] = url.split("?");
    const [queryPart, hashPart = ""] = query.split("#");
    const params = new URLSearchParams(queryPart || hashPart);
    return params.get("code");
  }
}

function getOAuthAttemptIdFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("oauth_attempt");
  } catch {
    const [, query = ""] = url.split("?");
    return new URLSearchParams(query.split("#")[0]).get("oauth_attempt");
  }
}

function createOAuthAttemptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildOAuthRedirectUrl(attemptId: string) {
  const separator = AUTH_REDIRECT_URL.includes("?") ? "&" : "?";
  return `${AUTH_REDIRECT_URL}${separator}oauth_attempt=${encodeURIComponent(attemptId)}`;
}

function parseStoredOAuthAttempt(value: string | null): OAuthAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OAuthAttempt>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.createdAt !== "number" ||
      !["kakao", "custom:naver", "apple"].includes(parsed.provider as string)
    )
      return null;
    return parsed as OAuthAttempt;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({
  audiencePolicy,
  children,
}: PropsWithChildren<{
  audiencePolicy: AudiencePolicy;
}>) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionRestoreComplete, setSessionRestoreComplete] = useState(false);
  const [isAudienceAuthIntentPending, setIsAudienceAuthIntentPending] =
    useState(false);
  const [authCompletionRevision, setAuthCompletionRevision] = useState(0);
  const authContinuationRef = useRef<AuthContinuation | null>(null);
  const isLoading = audiencePolicy.canAuthenticate && !sessionRestoreComplete;
  const canAuthenticateRef = useRef(audiencePolicy.canAuthenticate);
  const audienceAuthIntentRef = useRef(false);
  const audienceAuthIntentPreparedRef = useRef(false);
  const passwordRequestRevisionRef = useRef(0);
  const sessionMutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const sessionMutationActiveRef = useRef(false);
  const runSessionMutation = useCallback(<T,>(operation: () => Promise<T>) => {
    const task = sessionMutationQueueRef.current.catch(() => undefined).then(async () => {
      sessionMutationActiveRef.current = true;
      try {
        return await operation();
      } finally {
        sessionMutationActiveRef.current = false;
      }
    });
    sessionMutationQueueRef.current = task;
    return task;
  }, []);
  const activeOAuthAttemptRef = useRef<OAuthAttempt | null>(null);
  const oauthCallbackPromiseRef = useRef<{
    attemptId: string | null;
    promise: Promise<OAuthCallbackResult>;
  } | null>(null);
  const completedOAuthCallbackRef = useRef<{
    attemptId: string;
    result: OAuthCallbackResult;
  } | null>(null);
  canAuthenticateRef.current = audiencePolicy.canAuthenticate;

  const startAudienceAuthIntent = useCallback(() => {
    if (audienceAuthIntentRef.current) return;
    passwordRequestRevisionRef.current += 1;
    audienceAuthIntentRef.current = true;
    audienceAuthIntentPreparedRef.current = false;
    setIsAudienceAuthIntentPending(true);
  }, []);

  const resumeOAuthAudienceAuthIntent = useCallback(() => {
    // A persisted OAuth attempt is created only after the old local session is
    // cleared. On a cold callback, mark that preparation as already complete:
    // signing out here would delete Supabase's persisted PKCE code verifier.
    passwordRequestRevisionRef.current += 1;
    audienceAuthIntentRef.current = true;
    audienceAuthIntentPreparedRef.current = true;
    setIsAudienceAuthIntentPending(true);
  }, []);

  const cancelAudienceAuthIntent = useCallback(() => {
    passwordRequestRevisionRef.current += 1;
    audienceAuthIntentRef.current = false;
    audienceAuthIntentPreparedRef.current = false;
    setIsAudienceAuthIntentPending(false);
  }, []);

  const setAuthContinuation = useCallback(
    (continuation: AuthContinuation | null) => {
      authContinuationRef.current = continuation;
    },
    [],
  );

  const takeAuthContinuation = useCallback(() => {
    const continuation = authContinuationRef.current;
    authContinuationRef.current = null;
    return continuation;
  }, []);

  const clearAuthContinuation = useCallback(() => {
    authContinuationRef.current = null;
  }, []);

  const clearOAuthAttempt = useCallback(async () => {
    activeOAuthAttemptRef.current = null;
    await SecureStore.deleteItemAsync(OAUTH_ATTEMPT_STORAGE_KEY).catch(
      () => {},
    );
  }, []);

  const createOAuthAttempt = useCallback(
    async (provider: SocialAuthProvider) => {
      const attempt: OAuthAttempt = {
        createdAt: Date.now(),
        id: createOAuthAttemptId(),
        provider,
      };
      completedOAuthCallbackRef.current = null;
      activeOAuthAttemptRef.current = attempt;
      await SecureStore.setItemAsync(
        OAUTH_ATTEMPT_STORAGE_KEY,
        JSON.stringify(attempt),
      );
      return attempt;
    },
    [],
  );

  const loadOAuthAttempt = useCallback(async () => {
    const attempt =
      activeOAuthAttemptRef.current ??
      parseStoredOAuthAttempt(
        await SecureStore.getItemAsync(OAUTH_ATTEMPT_STORAGE_KEY).catch(
          () => null,
        ),
      );
    if (!attempt) return null;
    if (Date.now() - attempt.createdAt > OAUTH_ATTEMPT_TTL_MS) {
      await clearOAuthAttempt();
      return null;
    }
    activeOAuthAttemptRef.current = attempt;
    return attempt;
  }, [clearOAuthAttempt]);

  const applySession = useCallback((currentSession: Session | null) => {
    if (!canAuthenticateRef.current) {
      setSession(null);
      setUser(null);
      return clearAuthToken().catch(() => {});
    }

    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.access_token) {
      return setAuthToken(currentSession.access_token).catch(() => {});
    } else {
      return clearAuthToken().catch(() => {});
    }
  }, []);

  const applyCompletedAuthSession = useCallback(
    (currentSession: Session | null) => {
      if (!currentSession) {
        cancelAudienceAuthIntent();
        return false;
      }
      applySession(currentSession);
      setAuthCompletionRevision((revision) => revision + 1);
      cancelAudienceAuthIntent();
      return true;
    },
    [applySession, cancelAudienceAuthIntent],
  );

  const prepareAudienceAuthIntent = useCallback(() => runSessionMutation(async () => {
    if (!audienceAuthIntentRef.current || audienceAuthIntentPreparedRef.current)
      return;

    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    await signOutPushDevice(data.session?.access_token, async () => {
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result?.error) throw result.error;
      await clearAuthToken();
    });
    await applySession(null);
    audienceAuthIntentPreparedRef.current = true;
  }), [applySession, runSessionMutation]);

  const rejectIfPolicyChanged =
    useCallback(async (): Promise<AuthError | null> => {
      if (canAuthenticateRef.current) return null;

      const supabase = getSupabase();
      await Promise.allSettled([supabase.auth.signOut(), clearAuthToken()]);
      setSession(null);
      setUser(null);
      return createAudienceRestrictedAuthError();
    }, []);

  const processOAuthCallbackUrl = useCallback(
    async (url: string): Promise<OAuthCallbackResult> => {
      if (!canAuthenticateRef.current) return { handled: false, error: null };

      const callbackAttemptId = getOAuthAttemptIdFromUrl(url);
      if (!callbackAttemptId) return { handled: false, error: null };

      const completedCallback = completedOAuthCallbackRef.current;
      if (completedCallback?.attemptId === callbackAttemptId) {
        return completedCallback.result;
      }

      const attempt = await loadOAuthAttempt();
      if (!attempt || attempt.id !== callbackAttemptId) {
        return { handled: false, error: null };
      }

      resumeOAuthAudienceAuthIntent();
      const code = getAuthCodeFromUrl(url);
      await clearOAuthAttempt();
      if (!code) {
        cancelAudienceAuthIntent();
        return { handled: true, error: createOAuthCallbackError(url) };
      }

      try {
        return await runSessionMutation<OAuthCallbackResult>(async () => {
          const supabase = getSupabase();
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          const restrictionError = await rejectIfPolicyChanged();
          if (restrictionError) {
            cancelAudienceAuthIntent();
            return { handled: true, error: restrictionError };
          }
          if (error) {
            cancelAudienceAuthIntent();
            return { handled: true, error };
          }
          if (!applyCompletedAuthSession(data.session)) {
            return { handled: true, error: createOAuthCallbackError() };
          }
          return { handled: true, error: null };
        });
      } catch (error) {
        cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      applyCompletedAuthSession,
      cancelAudienceAuthIntent,
      clearOAuthAttempt,
      loadOAuthAttempt,
      rejectIfPolicyChanged,
      resumeOAuthAudienceAuthIntent,
      runSessionMutation,
    ],
  );

  const handleAuthCallbackUrl = useCallback(
    async (url: string): Promise<OAuthCallbackResult> => {
      const callbackAttemptId = getOAuthAttemptIdFromUrl(url);
      const activeCallback = oauthCallbackPromiseRef.current;
      if (activeCallback?.attemptId === callbackAttemptId) {
        return activeCallback.promise;
      }

      const callbackPromise = processOAuthCallbackUrl(url);
      oauthCallbackPromiseRef.current = {
        attemptId: callbackAttemptId,
        promise: callbackPromise,
      };
      try {
        const result = await callbackPromise;
        if (result.handled && callbackAttemptId) {
          completedOAuthCallbackRef.current = {
            attemptId: callbackAttemptId,
            result,
          };
        }
        return result;
      } finally {
        if (oauthCallbackPromiseRef.current?.promise === callbackPromise) {
          oauthCallbackPromiseRef.current = null;
        }
      }
    },
    [processOAuthCallbackUrl],
  );

  // Restore session on mount
  useEffect(() => {
    if (!audiencePolicy.canAuthenticate) {
      setSession(null);
      setUser(null);
      setSessionRestoreComplete(false);
      clearAuthToken().catch(() => {});
      return;
    }

    const supabase = getSupabase();
    let active = true;
    const skipExistingSessionRestore = audienceAuthIntentRef.current;
    setSessionRestoreComplete(false);

    if (skipExistingSessionRestore) {
      setSessionRestoreComplete(true);
    } else {
      void supabase.auth
        .getSession()
        .then(({ data: { session: currentSession } }) => {
          if (!active || audienceAuthIntentRef.current) return;
          applySession(currentSession);
        })
        .catch(() => {
          if (!active || audienceAuthIntentRef.current) return;
          applySession(null);
        })
        .finally(() => {
          if (active) setSessionRestoreComplete(true);
        });
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT") return applySession(null);
      if (sessionMutationActiveRef.current) return;
      if (audienceAuthIntentRef.current) return;
      applySession(currentSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession, audiencePolicy.canAuthenticate]);

  useEffect(() => {
    if (!audiencePolicy.canAuthenticate) return;

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleAuthCallbackUrl(url).catch(() => {});
        }
      })
      .catch(() => {});

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAuthCallbackUrl(url).catch(() => {});
    });

    return () => {
      subscription.remove();
    };
  }, [audiencePolicy.canAuthenticate, handleAuthCallbackUrl]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const revision = ++passwordRequestRevisionRef.current;
      const isCurrent = () => revision === passwordRequestRevisionRef.current;
      try {
        await prepareAudienceAuthIntent();
        if (!isCurrent()) return createCancelledAuthRequestError();
        const requestClient = createSupabaseAuthRequestClient();
        const { data, error } = await requestClient.auth.signInWithPassword({
          email,
          password,
        });
        if (!isCurrent()) return createCancelledAuthRequestError();
        if (!canAuthenticateRef.current) {
          return await runSessionMutation(rejectIfPolicyChanged);
        }
        if (error) {
          cancelAudienceAuthIntent();
          return error;
        }
        if (!data?.session) {
          cancelAudienceAuthIntent();
          return createMissingAuthSessionError();
        }
        return await runSessionMutation(async () => {
          if (!isCurrent() || !canAuthenticateRef.current) return createCancelledAuthRequestError();
          const supabase = getSupabase();
          const discardSession = async () => {
            const cleanup = await supabase.auth.signOut({ scope: "local" })
              .catch(() => ({ error: true }));
            if (cleanup?.error) await discardSupabaseAuthSession();
            await applySession(null);
            return createCancelledAuthRequestError();
          };
          const committed = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          if (!isCurrent() || !canAuthenticateRef.current) {
            // No newer preparation/commit can run until this cleanup finishes.
            // In particular, it cannot remove a newer OAuth PKCE verifier.
            return discardSession();
          }
          if (committed.error) {
            cancelAudienceAuthIntent();
            return committed.error;
          }
          if (!committed.data.session) {
            cancelAudienceAuthIntent();
            return createMissingAuthSessionError();
          }
          await setAuthToken(committed.data.session.access_token);
          if (!isCurrent() || !canAuthenticateRef.current) return discardSession();
          applyCompletedAuthSession(committed.data.session);
          return null;
        });
      } catch (error) {
        if (isCurrent()) cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      applySession,
      applyCompletedAuthSession,
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
      runSessionMutation,
    ],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      try {
        await prepareAudienceAuthIntent();
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
        });
        const restrictionError = await rejectIfPolicyChanged();
        if (restrictionError) {
          cancelAudienceAuthIntent();
          return restrictionError;
        }
        if (error) {
          cancelAudienceAuthIntent();
          return error;
        }
        if (data?.session) {
          applyCompletedAuthSession(data.session);
        } else {
          cancelAudienceAuthIntent();
        }
        return null;
      } catch (error) {
        cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      applyCompletedAuthSession,
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const signUpWithEmailCode = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>,
    ): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      try {
        await prepareAudienceAuthIntent();
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: metadata,
          },
        });
        const restrictionError = await rejectIfPolicyChanged();
        if (restrictionError) {
          cancelAudienceAuthIntent();
          return restrictionError;
        }
        if (error) {
          cancelAudienceAuthIntent();
          return error;
        }
        if (data?.session) {
          applyCompletedAuthSession(data.session);
        }
        return null;
      } catch (error) {
        cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      applyCompletedAuthSession,
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const resendEmailSignUpCode = useCallback(
    async (email: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      await prepareAudienceAuthIntent();
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
        },
      });
      const restrictionError = await rejectIfPolicyChanged();
      if (restrictionError) {
        cancelAudienceAuthIntent();
        return restrictionError;
      }
      return error;
    },
    [
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const verifyEmailCode = useCallback(
    async (email: string, token: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      await prepareAudienceAuthIntent();
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      const restrictionError = await rejectIfPolicyChanged();
      if (restrictionError) {
        cancelAudienceAuthIntent();
        return restrictionError;
      }
      if (!error) {
        if (!applyCompletedAuthSession(data.session)) {
          return createMissingAuthSessionError();
        }
      }
      return error;
    },
    [
      applyCompletedAuthSession,
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const signUpWithMetadata = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>,
    ): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      try {
        await prepareAudienceAuthIntent();
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            ...(metadata ? { data: metadata } : {}),
          },
        });
        const restrictionError = await rejectIfPolicyChanged();
        if (restrictionError) {
          cancelAudienceAuthIntent();
          return restrictionError;
        }
        if (error) {
          cancelAudienceAuthIntent();
          return error;
        }
        if (data?.session) {
          applyCompletedAuthSession(data.session);
        } else {
          cancelAudienceAuthIntent();
        }
        return null;
      } catch (error) {
        cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      applyCompletedAuthSession,
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const signOut = useCallback(async (options?: { accountDeleted?: boolean }) => {
    cancelAudienceAuthIntent();
    await clearOAuthAttempt();
    const supabase = getSupabase();
    await runSessionMutation(async () => {
      const currentSession = options?.accountDeleted ? session
        : (await supabase.auth.getSession()).data.session ?? session;
      const accessToken = options?.accountDeleted ? undefined : currentSession?.access_token;
      await signOutPushDevice(accessToken, () => signOutLocalNotifications(currentSession?.user.id, async () => {
        const result = await supabase.auth.signOut();
        if (result?.error) throw result.error;
        await clearAuthToken();
        await applySession(null);
      }));
    });
  }, [applySession, cancelAudienceAuthIntent, clearOAuthAttempt, runSessionMutation, session]);

  const signInWithOAuth = useCallback(
    async (provider: SocialAuthProvider): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      try {
        await prepareAudienceAuthIntent();
        const attempt = await createOAuthAttempt(provider);
        const redirectTo = buildOAuthRedirectUrl(attempt.id);
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        const restrictionError = await rejectIfPolicyChanged();
        if (restrictionError) {
          await clearOAuthAttempt();
          cancelAudienceAuthIntent();
          return restrictionError;
        }
        if (error || !data.url) {
          await clearOAuthAttempt();
          cancelAudienceAuthIntent();
          return error ?? createOAuthCallbackError();
        }

        const { openAuthSessionAsync } = await import("expo-web-browser");
        const result = await openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success") {
          await clearOAuthAttempt();
          cancelAudienceAuthIntent();
          return null;
        }

        const callbackResult = await handleAuthCallbackUrl(result.url);
        if (!callbackResult.handled) {
          await clearOAuthAttempt();
          cancelAudienceAuthIntent();
          return createOAuthCallbackError(result.url);
        }
        return callbackResult.error;
      } catch (error) {
        await clearOAuthAttempt();
        cancelAudienceAuthIntent();
        throw error;
      }
    },
    [
      audiencePolicy.canAuthenticate,
      cancelAudienceAuthIntent,
      clearOAuthAttempt,
      createOAuthAttempt,
      handleAuthCallbackUrl,
      prepareAudienceAuthIntent,
      rejectIfPolicyChanged,
    ],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isAudienceAuthIntentPending,
      authCompletionRevision,
      setAuthContinuation,
      takeAuthContinuation,
      clearAuthContinuation,
      signIn,
      signUp,
      signUpWithEmailCode,
      resendEmailSignUpCode,
      verifyEmailCode,
      signUpWithMetadata,
      signInWithOAuth,
      startAudienceAuthIntent,
      cancelAudienceAuthIntent,
      signOut,
    }),
    [
      user,
      session,
      isLoading,
      isAudienceAuthIntentPending,
      authCompletionRevision,
      setAuthContinuation,
      takeAuthContinuation,
      clearAuthContinuation,
      signIn,
      signUp,
      signUpWithEmailCode,
      resendEmailSignUpCode,
      verifyEmailCode,
      signUpWithMetadata,
      signInWithOAuth,
      startAudienceAuthIntent,
      cancelAudienceAuthIntent,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/** Returns auth state when mounted under AuthProvider, otherwise guest scope. */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
