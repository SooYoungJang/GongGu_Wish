import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { AuthProvider, useAuth } from '../context/AuthContext';
import type { AudiencePolicy } from '../audience/audiencePolicy';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getAllKeys: vi.fn().mockResolvedValue([]),
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

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
const mockSetSession = vi.fn();
const {
  mockOpenAuthSessionAsync,
  mockSecureStoreDeleteItem,
  mockSecureStoreGetItem,
  mockSecureStoreSetItem,
  mockDiscardSupabaseAuthSession,
} = vi.hoisted(() => ({
  mockOpenAuthSessionAsync: vi.fn(),
  mockSecureStoreDeleteItem: vi.fn(),
  mockSecureStoreGetItem: vi.fn(),
  mockSecureStoreSetItem: vi.fn(),
  mockDiscardSupabaseAuthSession: vi.fn(),
}));

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
      setSession: mockSetSession,
    },
  }),
}));

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  getItemAsync: mockSecureStoreGetItem,
  setItemAsync: mockSecureStoreSetItem,
  deleteItemAsync: mockSecureStoreDeleteItem,
}));

vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: mockOpenAuthSessionAsync,
}));

// Mock lib/supabase to return a valid client
vi.mock('../lib/supabase', () => ({
  configureSupabase: vi.fn(),
  createSupabaseAuthRequestClient: vi.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  })),
  discardSupabaseAuthSession: mockDiscardSupabaseAuthSession,
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
      setSession: mockSetSession,
    },
  })),
}));

// Setup default mock behavior
mockGetSession.mockResolvedValue({ data: { session: null } });
mockOnAuthStateChange.mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

const pushDeviceMocks = vi.hoisted(() => ({ signOutPushDevice: vi.fn() }));
vi.mock('../services/pushDeviceSession', () => pushDeviceMocks);

function TestConsumer() {
  const auth = useAuth();
  return React.createElement("mock-auth-consumer" as any, {
    "data-user": auth.user?.email ?? null,
    "data-is-loading": String(auth.isLoading),
    "data-auth-completion-revision": String(auth.authCompletionRevision),
    "data-sign-out": auth.signOut,
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
    pushDeviceMocks.signOutPushDevice.mockReset().mockImplementation(async (_token, signOut) => signOut());
    mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockClear();
    mockSignInWithPassword.mockClear();
    mockSignUp.mockClear();
    mockResend.mockClear();
    mockVerifyOtp.mockClear();
    mockExchangeCodeForSession.mockClear();
    mockSignInWithOAuth.mockClear();
    mockSignOut.mockReset().mockResolvedValue({ error: null });
    mockSetSession.mockReset();
    mockDiscardSupabaseAuthSession.mockReset();
    mockSecureStoreGetItem.mockReset().mockResolvedValue(null);
    mockSecureStoreSetItem.mockReset().mockResolvedValue(undefined);
    mockSecureStoreDeleteItem.mockReset().mockResolvedValue(undefined);
    mockOpenAuthSessionAsync.mockReset().mockResolvedValue({ type: "cancel" });
    vi.mocked(Linking.getInitialURL).mockReset().mockResolvedValue(null);
  });

  it('renders children', () => {
    const renderer = renderAuthTest();
    expect(renderer.root.findByType('mock-auth-consumer' as any)).toBeTruthy();
  });

  it('releases the signed-in device before removing authentication', async () => {
    const aliceSession = { access_token: 'alice-token', user: { id: 'alice', email: 'alice@example.com' } };
    mockGetSession.mockResolvedValue({ data: { session: aliceSession } });
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    pushDeviceMocks.signOutPushDevice.mockImplementation(async (_token, signOut) => {
      await released;
      return signOut();
    });
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => { renderer = renderAuthTest(); });
    let logout!: Promise<void>;
    await act(async () => { logout = renderer.root.findByType('mock-auth-consumer' as any).props['data-sign-out'](); });
    expect(pushDeviceMocks.signOutPushDevice).toHaveBeenCalledWith('alice-token', expect.any(Function));
    expect(mockSignOut).not.toHaveBeenCalled();
    await act(async () => { release(); await logout; });
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(renderer.root.findByType('mock-auth-consumer' as any).props['data-user']).toBeNull();
    act(() => renderer.unmount());
    mockGetSession.mockResolvedValue({ data: { session: null } });
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

  it("reports loading while restoring a session after authentication becomes allowed", async () => {
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
          { audiencePolicy: AGE_13_POLICY },
          React.createElement(TestConsumer),
        ),
      );
      await Promise.resolve();
    });

    expect(
      renderer.root.findByType("mock-auth-consumer" as any).props[
        "data-is-loading"
      ],
    ).toBe("false");

    await act(async () => {
      renderer.update(
        React.createElement(
          AuthProvider,
          { audiencePolicy: UNRESTRICTED_POLICY },
          React.createElement(TestConsumer),
        ),
      );
      await Promise.resolve();
    });

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findByType("mock-auth-consumer" as any).props[
        "data-is-loading"
      ],
    ).toBe("true");

    await act(async () => {
      resolveSession({ data: { session: null } });
      await Promise.resolve();
    });

    expect(
      renderer.root.findByType("mock-auth-consumer" as any).props[
        "data-is-loading"
      ],
    ).toBe("false");
  });

  it("suppresses every stale session event until the selected auth request wins", async () => {
    let currentAuth: ReturnType<typeof useAuth> | null = null;
    function AuthProbe() {
      currentAuth = useAuth();
      return null;
    }

    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          AuthProvider,
          { audiencePolicy: AGE_13_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });

    act(() => {
      currentAuth!.startAudienceAuthIntent();
    });
    await act(async () => {
      renderer.update(
        React.createElement(
          AuthProvider,
          { audiencePolicy: UNRESTRICTED_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(currentAuth!.isLoading).toBe(false);
    expect(currentAuth!.isAudienceAuthIntentPending).toBe(true);

    const authStateListener = mockOnAuthStateChange.mock.calls[0][0];
    act(() => {
      authStateListener("INITIAL_SESSION", {
        access_token: "stale-token",
        user: { email: "stale@example.com" },
      });
    });
    expect(currentAuth!.user).toBeNull();

    act(() => {
      authStateListener("TOKEN_REFRESHED", {
        access_token: "stale-refreshed-token",
        user: { email: "stale@example.com" },
      });
    });
    expect(currentAuth!.user).toBeNull();

    const selectedSession = {
      access_token: "selected-token",
      refresh_token: "selected-refresh-token",
      user: { email: "selected@example.com" },
    };
    mockSignInWithPassword.mockResolvedValueOnce({ data: { session: selectedSession }, error: null });
    mockSetSession.mockResolvedValueOnce({ data: { session: selectedSession }, error: null });
    await act(async () => {
      await currentAuth!.signIn("selected@example.com", "password");
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(currentAuth!.user?.email).toBe("selected@example.com");
    expect(currentAuth!.isAudienceAuthIntentPending).toBe(false);
    expect(currentAuth!.authCompletionRevision).toBe(1);
  });

  it("unlocks OAuth controls after browser cancellation and permits a retry", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://example.com/oauth" },
      error: null,
    });

    let currentAuth: ReturnType<typeof useAuth> | null = null;
    function AuthProbe() {
      currentAuth = useAuth();
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        React.createElement(
          AuthProvider,
          { audiencePolicy: UNRESTRICTED_POLICY },
          React.createElement(AuthProbe),
        ),
      );
      await Promise.resolve();
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      act(() => currentAuth!.startAudienceAuthIntent());
      await act(async () => {
        expect(await currentAuth!.signInWithOAuth("kakao")).toBeNull();
      });
      expect(currentAuth!.isAudienceAuthIntentPending).toBe(false);
    }

    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(2);
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledTimes(2);
    expect(mockSecureStoreSetItem).toHaveBeenCalledTimes(2);
    expect(mockSecureStoreDeleteItem).toHaveBeenCalled();
    expect(currentAuth!.authCompletionRevision).toBe(0);
  });

  it("preserves the PKCE verifier before exchanging a cold Naver callback", async () => {
    let pkceVerifierAvailable = true;
    mockSecureStoreGetItem.mockResolvedValueOnce(
      JSON.stringify({
        createdAt: Date.now(),
        id: "cold-naver-attempt",
        provider: "custom:naver",
      }),
    );
    vi.mocked(Linking.getInitialURL).mockResolvedValueOnce(
      "gongguwish-preview://auth/callback?oauth_attempt=cold-naver-attempt&code=cold-naver-auth-code",
    );
    mockSignOut.mockImplementation(async () => {
      pkceVerifierAvailable = false;
      return { error: null };
    });
    mockExchangeCodeForSession.mockImplementationOnce(async () =>
      pkceVerifierAvailable
        ? {
            data: {
              session: {
                access_token: "cold-naver-access-token",
                user: { email: "naver@example.com" },
              },
            },
            error: null,
          }
        : {
            data: { session: null },
            error: { message: "PKCE code verifier is missing" },
          },
    );

    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = renderAuthTest();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(
      "cold-naver-auth-code",
    );
    expect(
      renderer.root.findByType("mock-auth-consumer" as any).props["data-user"],
    ).toBe("naver@example.com");
  });

  it("ignores a session restore that finishes after the audience becomes restricted", async () => {
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

  describe('cancelled authentication requests', () => {
    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((complete) => { resolve = complete; });
      return { promise, resolve };
    }

    function sessionFor(id: string): Session {
      return {
        access_token: `${id}-access-token`,
        refresh_token: `${id}-refresh-token`,
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id,
          email: `${id}@example.com`,
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-10-24T00:00:00Z',
        },
      };
    }

    async function createSessionHarness() {
      let persistedSession: Session | null = null;
      const sessions = new Map<string, Session>();
      const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
      const writeSession = async (session: Session | null) => {
        persistedSession = session;
        if (session) sessions.set(session.access_token, session);
        for (const listener of listeners) {
          await listener(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        }
        return { data: { session, user: session?.user ?? null }, error: null };
      };
      const requestResult = (session: Session) => {
        // An isolated password client returns credentials without writing the shared SDK.
        sessions.set(session.access_token, session);
        return { data: { session, user: session.user }, error: null };
      };
      const commitSession = async ({ access_token }: { access_token: string; refresh_token: string }) => {
        const session = sessions.get(access_token);
        if (!session) throw new Error('Unknown test session');
        return writeSession(session);
      };

      mockGetSession.mockImplementation(async () => ({ data: { session: persistedSession }, error: null }));
      mockOnAuthStateChange.mockReset().mockImplementation((listener) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      });
      mockSignOut.mockImplementation(async () => {
        await writeSession(null);
        return { error: null };
      });
      mockSetSession.mockReset().mockImplementation(commitSession);
      mockSignInWithPassword.mockReset();

      let currentAuth!: ReturnType<typeof useAuth>;
      function AuthProbe() {
        currentAuth = useAuth();
        return null;
      }
      let renderer!: ReturnType<typeof TestRenderer.create>;
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(AuthProvider, { audiencePolicy: UNRESTRICTED_POLICY }, React.createElement(AuthProbe)),
        );
      });
      return {
        getAuth: () => currentAuth,
        getPersistedSession: () => persistedSession,
        requestResult,
        commitSession,
        clearSession: () => writeSession(null),
        unmount: () => act(() => renderer.unmount()),
      };
    }

    it('keeps the newer account after a cancelled password request returns late', async () => {
      const harness = await createSessionHarness();
      const olderStarted = deferred();
      const releaseOlder = deferred();
      const olderSession = sessionFor('older');
      const newerSession = sessionFor('newer');
      mockSignInWithPassword
        .mockImplementationOnce(async () => {
          olderStarted.resolve();
          await releaseOlder.promise;
          return harness.requestResult(olderSession);
        })
        .mockImplementationOnce(() => harness.requestResult(newerSession));

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        let olderRequest!: ReturnType<ReturnType<typeof useAuth>['signIn']>;
        await act(async () => {
          olderRequest = harness.getAuth().signIn('older@example.com', 'password');
          await olderStarted.promise;
        });
        // Leaving Login runs cancelAudienceAuthIntent in its beforeRemove listener.
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { await harness.getAuth().signIn('newer@example.com', 'password'); });
        expect(harness.getAuth().user?.id).toBe('newer');
        expect(harness.getPersistedSession()?.user.id).toBe('newer');

        await act(async () => { releaseOlder.resolve(); await olderRequest; });

        await vi.waitFor(() => {
          expect(harness.getAuth().user?.id).toBe('newer');
          expect(harness.getPersistedSession()?.user.id).toBe('newer');
        });
        expect(harness.getAuth().authCompletionRevision).toBe(1);
      } finally {
        releaseOlder.resolve();
        harness.unmount();
      }
    });

    it('keeps the newer account when an older shared session commit finishes after cancellation', async () => {
      const harness = await createSessionHarness();
      const releaseCommit = deferred();
      mockSignInWithPassword
        .mockImplementationOnce(() => harness.requestResult(sessionFor('older-commit')))
        .mockImplementationOnce(() => harness.requestResult(sessionFor('newer-commit')));
      mockSetSession.mockImplementationOnce(async (tokens) => {
        await releaseCommit.promise;
        return harness.commitSession(tokens);
      });
      let olderRequest: Promise<unknown> | undefined;
      let newerRequest: Promise<unknown> | undefined;

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { olderRequest = harness.getAuth().signIn('older-commit@example.com', 'password'); });
        await vi.waitFor(() => expect(mockSetSession).toHaveBeenCalledTimes(1));
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { newerRequest = harness.getAuth().signIn('newer-commit@example.com', 'password'); });

        // Shared SDK writes may serialize; only their final account matters.
        await act(async () => { releaseCommit.resolve(); await Promise.all([olderRequest, newerRequest]); });

        await vi.waitFor(() => {
          expect(harness.getAuth().user?.id).toBe('newer-commit');
          expect(harness.getPersistedSession()?.user.id).toBe('newer-commit');
        });
        expect(harness.getAuth().isAudienceAuthIntentPending).toBe(false);
        expect(harness.getAuth().authCompletionRevision).toBe(1);
      } finally {
        releaseCommit.resolve();
        await act(async () => { await Promise.allSettled([olderRequest, newerRequest]); });
        harness.unmount();
      }
    });

    it('keeps the newer account when cancellation interrupts token persistence', async () => {
      const harness = await createSessionHarness();
      const tokenWriteStarted = deferred();
      const releaseTokenWrite = deferred();
      const olderSession = sessionFor('older-token');
      const newerSession = sessionFor('newer-token');
      mockSignInWithPassword
        .mockImplementationOnce(() => harness.requestResult(olderSession))
        .mockImplementationOnce(() => harness.requestResult(newerSession));
      mockSecureStoreSetItem.mockImplementation(async (key, value) => {
        if (key === 'gonggu.authToken' && value === olderSession.access_token) {
          tokenWriteStarted.resolve();
          await releaseTokenWrite.promise;
        }
      });
      let olderRequest: Promise<unknown> | undefined;
      let newerRequest: Promise<unknown> | undefined;

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => {
          olderRequest = harness.getAuth().signIn('older-token@example.com', 'password');
          await tokenWriteStarted.promise;
        });
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { newerRequest = harness.getAuth().signIn('newer-token@example.com', 'password'); });
        await act(async () => {
          releaseTokenWrite.resolve();
          await Promise.all([olderRequest, newerRequest]);
        });

        expect(harness.getAuth().user?.id).toBe('newer-token');
        expect(harness.getPersistedSession()?.user.id).toBe('newer-token');
        expect(mockSecureStoreSetItem.mock.calls.filter(([key]) => key === 'gonggu.authToken').at(-1)?.[1])
          .toBe(newerSession.access_token);
        expect(harness.getAuth().authCompletionRevision).toBe(1);
      } finally {
        releaseTokenWrite.resolve();
        await act(async () => { await Promise.allSettled([olderRequest, newerRequest]); });
        harness.unmount();
      }
    });

    it.each(['returned', 'thrown'] as const)('clears a cancelled session when local sign-out has a %s network error', async (failure) => {
      const harness = await createSessionHarness();
      const releaseCommit = deferred();
      mockSignInWithPassword.mockImplementationOnce(() => harness.requestResult(sessionFor('cancelled-offline')));
      mockSetSession.mockImplementationOnce(async (tokens) => {
        await releaseCommit.promise;
        return harness.commitSession(tokens);
      });
      mockDiscardSupabaseAuthSession.mockImplementation(async () => { await harness.clearSession(); });
      let request: Promise<unknown> | undefined;
      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { request = harness.getAuth().signIn('offline@example.com', 'password'); });
        await vi.waitFor(() => expect(mockSetSession).toHaveBeenCalledOnce());
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        const offline = new Error('Network unavailable');
        if (failure === 'returned') mockSignOut.mockResolvedValueOnce({ error: offline });
        else mockSignOut.mockRejectedValueOnce(offline);
        await act(async () => { releaseCommit.resolve(); await request?.catch(() => undefined); });

        expect(harness.getPersistedSession()).toBeNull();
        expect(harness.getAuth().user).toBeNull();
        expect(mockDiscardSupabaseAuthSession).toHaveBeenCalledOnce();
        expect(harness.getAuth().authCompletionRevision).toBe(0);
      } finally {
        releaseCommit.resolve();
        await request?.catch(() => undefined);
        harness.unmount();
      }
    });

    it('clears the visible account when refresh invalidates the session before device release fails', async () => {
      const harness = await createSessionHarness();
      mockSignInWithPassword.mockImplementationOnce(() => harness.requestResult(sessionFor('expired-session')));
      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { await harness.getAuth().signIn('expired@example.com', 'password'); });
        mockGetSession.mockImplementationOnce(async () => {
          await harness.clearSession();
          return { data: { session: null }, error: new Error('Refresh token invalid') };
        });
        pushDeviceMocks.signOutPushDevice.mockRejectedValueOnce(new Error('Device release failed'));
        await act(async () => { await expect(harness.getAuth().signOut()).rejects.toThrow('Device release failed'); });

        expect(harness.getPersistedSession()).toBeNull();
        expect(harness.getAuth().user).toBeNull();
      } finally {
        harness.unmount();
      }
    });

    it('preserves OAuth preparation when a cancelled shared password commit finishes', async () => {
      const harness = await createSessionHarness();
      const releaseCommit = deferred();
      const browserStarted = deferred();
      const releaseBrowser = deferred();
      let pkceVerifierAvailable = false;
      mockSignInWithPassword.mockImplementationOnce(() => harness.requestResult(sessionFor('before-oauth')));
      mockSetSession.mockImplementationOnce(async (tokens) => {
        await releaseCommit.promise;
        return harness.commitSession(tokens);
      });
      mockSignOut.mockImplementation(async () => {
        pkceVerifierAvailable = false;
        await harness.clearSession();
        return { error: null };
      });
      mockSignInWithOAuth.mockReset().mockImplementation(async () => {
        pkceVerifierAvailable = true;
        return { data: { url: 'https://example.com/oauth' }, error: null };
      });
      mockOpenAuthSessionAsync.mockImplementationOnce(async () => {
        browserStarted.resolve();
        await releaseBrowser.promise;
        return { type: 'cancel' };
      });
      let passwordRequest: Promise<unknown> | undefined;
      let oauthRequest: Promise<unknown> | undefined;

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { passwordRequest = harness.getAuth().signIn('before-oauth@example.com', 'password'); });
        await vi.waitFor(() => expect(mockSetSession).toHaveBeenCalledTimes(1));
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        act(() => harness.getAuth().startAudienceAuthIntent());
        await act(async () => { oauthRequest = harness.getAuth().signInWithOAuth('kakao'); });
        await act(async () => {
          releaseCommit.resolve();
          await passwordRequest;
          await browserStarted.promise;
        });

        expect(pkceVerifierAvailable).toBe(true);
        expect(harness.getAuth().user).toBeNull();
        expect(harness.getPersistedSession()).toBeNull();
        expect(harness.getAuth().isAudienceAuthIntentPending).toBe(true);
        expect(harness.getAuth().authCompletionRevision).toBe(0);
      } finally {
        releaseCommit.resolve();
        releaseBrowser.resolve();
        await act(async () => { await Promise.allSettled([passwordRequest, oauthRequest]); });
        harness.unmount();
      }
    });

    it('stays signed out when a login completes after leaving the auth screen', async () => {
      const harness = await createSessionHarness();
      const started = deferred();
      const release = deferred();
      mockSignInWithPassword.mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        return harness.requestResult(sessionFor('cancelled'));
      });

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        let request!: ReturnType<ReturnType<typeof useAuth>['signIn']>;
        await act(async () => {
          request = harness.getAuth().signIn('cancelled@example.com', 'password');
          await started.promise;
        });
        act(() => harness.getAuth().cancelAudienceAuthIntent());
        await act(async () => { release.resolve(); await request; });

        await vi.waitFor(() => {
          expect(harness.getAuth().user).toBeNull();
          expect(harness.getPersistedSession()).toBeNull();
        });
        expect(harness.getAuth().authCompletionRevision).toBe(0);
      } finally {
        release.resolve();
        harness.unmount();
      }
    });

    it('does not restore a pending login after the user signs out', async () => {
      const harness = await createSessionHarness();
      const started = deferred();
      const release = deferred();
      mockSignInWithPassword.mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        return harness.requestResult(sessionFor('logged-out'));
      });

      try {
        act(() => harness.getAuth().startAudienceAuthIntent());
        let request!: ReturnType<ReturnType<typeof useAuth>['signIn']>;
        await act(async () => {
          request = harness.getAuth().signIn('logged-out@example.com', 'password');
          await started.promise;
        });
        let logout!: Promise<void>;
        await act(async () => {
          logout = harness.getAuth().signOut();
          await Promise.resolve();
        });
        await act(async () => { release.resolve(); await Promise.all([request, logout]); });

        await vi.waitFor(() => {
          expect(harness.getAuth().user).toBeNull();
          expect(harness.getPersistedSession()).toBeNull();
        });
        expect(harness.getAuth().authCompletionRevision).toBe(0);
      } finally {
        release.resolve();
        harness.unmount();
      }
    });
  });
});
