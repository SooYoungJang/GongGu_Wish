import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../context/AuthContext';

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
      React.createElement(AuthProvider, null,
        React.createElement(TestConsumer),
      ),
    );
  });
  return renderer!;
}

describe('AuthProvider', () => {
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
});
