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
import { Linking } from "react-native";

import type { AudiencePolicy } from "../audience/audiencePolicy";
import { AUTH_REDIRECT_URL } from "../lib/auth-config";
import { getSupabase } from "../lib/supabase";
import { setAuthToken, clearAuthToken } from "../utils/auth";
import type { SocialAuthProvider } from "../utils/authHelpers";

export const EMAIL_CODE_TTL_SECONDS = 5 * 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** Current authenticated user, or null if not logged in */
  user: User | null;
  /** Current Supabase session, or null if not logged in */
  session: Session | null;
  /** True while restoring session on mount */
  isLoading: boolean;
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
  /** Log out the current user */
  signOut: () => Promise<void>;
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({
  audiencePolicy,
  children,
}: PropsWithChildren<{
  audiencePolicy: AudiencePolicy;
}>) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canAuthenticateRef = useRef(audiencePolicy.canAuthenticate);
  canAuthenticateRef.current = audiencePolicy.canAuthenticate;

  const applySession = useCallback((currentSession: Session | null) => {
    if (!canAuthenticateRef.current) {
      setSession(null);
      setUser(null);
      clearAuthToken().catch(() => {});
      return;
    }

    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.access_token) {
      setAuthToken(currentSession.access_token).catch(() => {});
    } else {
      clearAuthToken().catch(() => {});
    }
  }, []);

  const rejectIfPolicyChanged = useCallback(async (): Promise<AuthError | null> => {
    if (canAuthenticateRef.current) return null;

    const supabase = getSupabase();
    await Promise.allSettled([supabase.auth.signOut(), clearAuthToken()]);
    setSession(null);
    setUser(null);
    return createAudienceRestrictedAuthError();
  }, []);

  const handleAuthCallbackUrl = useCallback(
    async (url: string) => {
      if (!canAuthenticateRef.current) return;
      const code = getAuthCodeFromUrl(url);
      if (!code) return;

      const supabase = getSupabase();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (await rejectIfPolicyChanged()) return;
      if (!error) {
        applySession(data.session);
      }
    },
    [applySession, rejectIfPolicyChanged],
  );

  // Restore session on mount
  useEffect(() => {
    if (!audiencePolicy.canAuthenticate) {
      setSession(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    let active = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!active) return;
      applySession(currentSession);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!active) return;
      applySession(currentSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession, audiencePolicy.canAuthenticate]);

  useEffect(() => {
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
  }, [handleAuthCallbackUrl]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return (await rejectIfPolicyChanged()) ?? error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
        },
      });
      return (await rejectIfPolicyChanged()) ?? error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
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
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
          data: metadata,
        },
      });
      return (await rejectIfPolicyChanged()) ?? error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
  );

  const resendEmailSignUpCode = useCallback(
    async (email: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
        },
      });
      return (await rejectIfPolicyChanged()) ?? error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
  );

  const verifyEmailCode = useCallback(
    async (email: string, token: string): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      const restrictionError = await rejectIfPolicyChanged();
      if (restrictionError) return restrictionError;
      if (!error) {
        applySession(data.session);
      }
      return error;
    },
    [
      applySession,
      audiencePolicy.canAuthenticate,
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
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
          ...(metadata ? { data: metadata } : {}),
        },
      });
      return (await rejectIfPolicyChanged()) ?? error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    await clearAuthToken();
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: SocialAuthProvider): Promise<AuthError | null> => {
      if (!audiencePolicy.canAuthenticate) {
        return createAudienceRestrictedAuthError();
      }
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: AUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });
      const restrictionError = await rejectIfPolicyChanged();
      if (restrictionError) return restrictionError;
      if (!error && data.url) {
        await Linking.openURL(data.url);
      }
      return error;
    },
    [audiencePolicy.canAuthenticate, rejectIfPolicyChanged],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signUpWithEmailCode,
      resendEmailSignUpCode,
      verifyEmailCode,
      signUpWithMetadata,
      signInWithOAuth,
      signOut,
    }),
    [
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signUpWithEmailCode,
      resendEmailSignUpCode,
      verifyEmailCode,
      signUpWithMetadata,
      signInWithOAuth,
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
