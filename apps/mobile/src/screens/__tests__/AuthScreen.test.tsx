/**
 * AuthScreen.test.tsx — Tests for AuthScreen (Coral Wave redesign)
 *
 * Covers:
 *  - Screen renders without crashing
 *  - Header with app name
 *  - Social login buttons
 *  - Login form fields
 *  - Signup tab present
 *  - Navigation flow (goBack on success, OAuth calls)
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { TextInput, Pressable, View, Text } from 'react-native';

import { AuthScreen } from '../AuthScreen';
import { ThemeProvider } from '../../context/ThemeContext';
import { AuthProvider } from '../../context/AuthContext';

// ─── Hoisted mocks (vi.hoisted ensures they're available when vi.mock factories run) ──

const { mockNavigate, mockGoBack, mockSignInWithPassword, mockSignUp, mockSignInWithOAuth } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockGoBack: vi.fn(),
    mockSignInWithPassword: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignInWithOAuth: vi.fn(),
  }),
);

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: vi.fn(),
    },
  })),
}));

vi.mock('../../lib/supabase', () => ({
  configureSupabase: vi.fn(),
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: vi.fn(),
    },
  })),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestRenderer() {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ThemeProvider, null,
        React.createElement(AuthProvider, null,
          React.createElement(AuthScreen),
        ),
      ),
    );
  });
  return renderer!;
}

function findAllText(
  root: TestRenderer.ReactTestRenderer,
  text: string | RegExp,
): TestRenderer.ReactTestInstance[] {
  return root.root.findAll((node) => {
    const nodeText = node.props?.['children'];
    if (nodeText === undefined || nodeText === null) return false;
    const str = typeof nodeText === 'string' ? nodeText : String(nodeText);
    if (text instanceof RegExp) return text.test(str);
    if (typeof nodeText === 'string' && typeof text === 'string') {
      return nodeText === text || nodeText.includes(text);
    }
    return str.includes(String(text));
  });
}

function findPressableByText(
  root: TestRenderer.ReactTestRenderer,
  text: string,
): TestRenderer.ReactTestInstance | undefined {
  return root.root.findAllByType(Pressable).find((p) => {
    const texts = p.findAllByType(Text);
    return texts.some((t) => t.props.children === text || t.props.children?.includes?.(text));
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AuthScreen', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const renderer = createTestRenderer();
    expect(renderer).toBeDefined();
  });

  it('renders social login buttons', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '카카오로 로그인').length).toBeGreaterThan(0);
    expect(findAllText(renderer, 'Apple로 로그인').length).toBeGreaterThan(0);
    expect(findAllText(renderer, 'Google로 로그인').length).toBeGreaterThan(0);
  });

  it('renders email and password floating labels', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '이메일').length).toBeGreaterThan(0);
    expect(findAllText(renderer, '비밀번호').length).toBeGreaterThan(0);
  });

  it('wraps auth TextInputs in touchable containers', () => {
    const renderer = createTestRenderer();
    const viewsWithInput = renderer.root.findAllByType(View).filter(
      (view) => view.props.onTouchEnd && view.findAllByType(TextInput).length > 0,
    );

    expect(viewsWithInput.length).toBeGreaterThan(0);
    viewsWithInput.forEach((view) => {
      expect(typeof view.props.onTouchEnd).toBe('function');
    });
  });

  it('renders forgot password link', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '비밀번호를 잊으셨나요?').length).toBeGreaterThan(0);
  });

  it('switches to the signup panel when the signup tab is pressed', () => {
    const renderer = createTestRenderer();
    const signupTab = renderer.root.findAllByType(Pressable).find(
      (p) => p.props.accessibilityLabel === '회원가입 탭',
    );
    expect(signupTab).toBeDefined();

    act(() => {
      signupTab!.props.onPress();
    });

    expect(findAllText(renderer, '기본 정보').length).toBeGreaterThan(0);
    expect(findAllText(renderer, '공구위시 가입을 위한 기본 정보를 입력해주세요').length).toBeGreaterThan(0);
    expect(findAllText(renderer, '비밀번호 확인').length).toBeGreaterThan(0);
  });

  it('renders app name', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '공구').length).toBeGreaterThan(0);
  });

  it('renders welcome message', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '함께 사면 더 즐거운 공동구매').length).toBeGreaterThan(0);
  });

  it('renders a shared back button that calls navigation.goBack()', () => {
    const renderer = createTestRenderer();
    const backButton = renderer.root.findAllByType(Pressable).find(
      (p) => p.props.accessibilityLabel === '뒤로가기',
    );

    expect(backButton).toBeDefined();
    expect(backButton!.props.accessibilityRole).toBe('button');

    act(() => {
      backButton!.props.onPress();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // ── Navigation Flow Tests ─────────────────────────────────────────────────

  it('calls navigation.goBack() on successful email login', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const renderer = createTestRenderer();

    // Find email and password TextInputs and fill them
    const allInputs = renderer.root.findAllByType(TextInput);
    const emailInput = allInputs.find((i) => i.props.accessibilityLabel === '이메일');
    const pwInput = allInputs.find((i) => i.props.accessibilityLabel === '비밀번호');
    expect(emailInput).toBeDefined();
    expect(pwInput).toBeDefined();

    act(() => {
      emailInput!.props.onChangeText('test@example.com');
      pwInput!.props.onChangeText('password123!');
    });

    // Find the login CTA button (unique by accessibilityLabel)
    const loginBtn = renderer.root.findAllByType(Pressable).find(
      (p) => p.props.accessibilityLabel === '로그인',
    );
    expect(loginBtn).toBeDefined();

    await act(async () => {
      loginBtn!.props.onPress();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123!',
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls signInWithOAuth with provider config when Kakao button pressed', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const renderer = createTestRenderer();

    const kakaoBtn = findPressableByText(renderer, '카카오로 로그인');
    expect(kakaoBtn).toBeDefined();

    await act(async () => {
      kakaoBtn!.props.onPress();
    });

    // signInWithOAuth receives { provider, options }
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: undefined },
    });
  });

  it('calls signInWithOAuth when Apple login button pressed', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const renderer = createTestRenderer();

    const appleBtn = findPressableByText(renderer, 'Apple로 로그인');
    expect(appleBtn).toBeDefined();

    await act(async () => {
      appleBtn!.props.onPress();
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: undefined },
    });
  });

  it('shows error text when social login fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const renderer = createTestRenderer();

    const googleBtn = findPressableByText(renderer, 'Google로 로그인');
    expect(googleBtn).toBeDefined();

    await act(async () => {
      googleBtn!.props.onPress();
    });

    expect(findAllText(renderer, '이메일 또는 비밀번호가 올바르지 않습니다.').length).toBeGreaterThan(0);
  });

  it('shows generic error on social login exception', async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error('Network error'));
    const renderer = createTestRenderer();

    const kakaoBtn = findPressableByText(renderer, '카카오로 로그인');
    expect(kakaoBtn).toBeDefined();

    await act(async () => {
      kakaoBtn!.props.onPress();
    });

    expect(findAllText(renderer, '소셜 로그인에 실패했습니다.').length).toBeGreaterThan(0);
  });
});
