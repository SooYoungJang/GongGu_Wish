import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { getSupabase } from '../lib/supabase';
import { setAuthToken, clearAuthToken } from '../utils/auth';

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
  /** Sign up with additional user metadata (nickname, etc.) */
  signUpWithMetadata: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) => Promise<AuthError | null>;
  /** Sign in with OAuth provider (kakao, apple, google) */
  signInWithOAuth: (provider: 'kakao' | 'apple' | 'google') => Promise<AuthError | null>;
  /** Log out the current user */
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.access_token) {
        setAuthToken(currentSession.access_token).catch(() => {});
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.access_token) {
        setAuthToken(currentSession.access_token).catch(() => {});
      } else {
        clearAuthToken().catch(() => {});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error;
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return error;
    },
    [],
  );

  const signUpWithMetadata = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>,
    ): Promise<AuthError | null> => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: metadata ? { data: metadata } : undefined,
      });
      return error;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    await clearAuthToken();
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: 'kakao' | 'apple' | 'google'): Promise<AuthError | null> => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: undefined, // Let the app handle redirect
        },
      });
      return error;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signUpWithMetadata,
      signInWithOAuth,
      signOut,
    }),
    [user, session, isLoading, signIn, signUp, signUpWithMetadata, signInWithOAuth, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
