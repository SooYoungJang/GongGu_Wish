import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../context/AuthContext';
import type { AudiencePolicy } from '../audience/audiencePolicy';

const UNRESTRICTED_POLICY: AudiencePolicy = {
  resolved: true,
  canUseApp: true,
  canAuthenticate: true,
  canRequestAds: true,
  canRecordBehaviorSignals: true,
};
const AGE_13_POLICY: AudiencePolicy = {
  resolved: true,
  canUseApp: true,
  canAuthenticate: false,
  canRequestAds: false,
  canRecordBehaviorSignals: false,
};

// Mock @supabase/supabase-js
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResend = vi.fn();
const mockVerifyOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      resend: mockResend,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  }),
}));

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

// Mock lib/supabase to return a valid client
vi.mock('../lib/supabase', () => ({
  configureSupabase: vi.fn(),
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      resend: mockResend,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  })),
}));

// Setup default mock behavior
mockGetSession.mockResolvedValue({ data: { session: null } });
mockOnAuthStateChange.mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

function TestConsumer() {
  const auth = useAuth();
  return React.createElement('mock-auth-consumer' as any, {
    'data-user': auth.user?.email ?? null,
    'data-is-loading': String(auth.isLoading),
  });
}

function renderAuthTest() {
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(AuthProvider, { audiencePolicy: UNRESTRICTED_POLICY },
        React.createElement(TestConsumer),
      ),
    );
  });
  return renderer!;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockClear();
    mockOnAuthStateChange.mockClear();
    mockSignInWithPassword.mockClear();
    mockSignUp.mockClear();
    mockResend.mockClear();
    mockVerifyOtp.mockClear();
    mockExchangeCodeForSession.mockClear();
    mockSignInWithOAuth.mockClear();
    mockSignOut.mockClear();
  });

  it('renders children', () => {
    const renderer = renderAuthTest();
    expect(renderer.root.findByType('mock-auth-consumer' as any)).toBeTruthy();
  });

  it('restores session on mount', () => {
    renderAuthTest();
    expect(mockGetSession).toHaveBeenCalled();
  });

  it('subscribes to auth state changes', () => {
    renderAuthTest();
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('does not restore a session or invoke sign-in while authentication is blocked', async () => {
    let currentAuth: ReturnType<typeof useAuth> | null = null;
    function AuthProbe() {
      currentAuth = useAuth();
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        React.createElement(
          AuthProvider,
          { audiencePolicy: AGE_13_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });

    const error = await currentAuth!.signIn('thirteen@example.com', 'password');

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockOnAuthStateChange).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(error?.message).toContain('만 14세 이상');
  });

  it('ignores a session restore that finishes after the audience becomes restricted', async () => {
    const resolveSession = vi.fn();
    mockGetSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession.mockImplementation(resolve);
      }),
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          AuthProvider,
          { audiencePolicy: UNRESTRICTED_POLICY },
          React.createElement(TestConsumer),
        ),
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.update(
        React.createElement(
          AuthProvider,
          { audiencePolicy: AGE_13_POLICY },
          React.createElement(TestConsumer),
        ),
      );
      await Promise.resolve();
    });

    await act(async () => {
      resolveSession({
        data: {
          session: {
            access_token: 'late-token',
            user: { email: 'late@example.com' },
          },
        },
      });
      await Promise.resolve();
    });

    expect(
      renderer.root.findByType('mock-auth-consumer' as any).props['data-user'],
    ).toBeNull();
  });

  it('signs out an authentication request that completes after restriction', async () => {
    let currentAuth: ReturnType<typeof useAuth> | null = null;
    const resolveSignIn = vi.fn();
    mockSignInWithPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignIn.mockImplementation(resolve);
      }),
    );
    function AuthProbe() {
      currentAuth = useAuth();
      return null;
    }

    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          AuthProvider,
          { audiencePolicy: UNRESTRICTED_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });

    let signInRequest!: Promise<unknown>;
    act(() => {
      signInRequest = currentAuth!.signIn('adult@example.com', 'password');
    });
    await act(async () => {
      renderer.update(
        React.createElement(
          AuthProvider,
          { audiencePolicy: AGE_13_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });
    await act(async () => {
      resolveSignIn({ error: null });
      await signInRequest;
    });

    expect(mockSignOut).toHaveBeenCalled();
  });
});
