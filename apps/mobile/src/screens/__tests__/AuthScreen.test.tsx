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

import { Keyboard, Platform, TextInput, Pressable, Text } from 'react-native';
import { AuthScreen, nextFocusedInputId } from '../AuthScreen';
import { ThemeProvider } from '../../context/ThemeContext';
import { AuthProvider } from '../../context/AuthContext';

// ─── Hoisted mocks (vi.hoisted ensures they're available when vi.mock factories run) ──

const {
  mockNavigate,
  mockGoBack,
  mockSignInWithPassword,
  mockSignUp,
  mockResend,
  mockVerifyOtp,
  mockExchangeCodeForSession,
  mockSignInWithOAuth,
  stableNavigation,
} = vi.hoisted(
  () => {
    const mockNavigate = vi.fn();
    const mockGoBack = vi.fn();
    const mockSignInWithPassword = vi.fn();
    const mockSignUp = vi.fn();
    const mockResend = vi.fn();
    const mockVerifyOtp = vi.fn();
    const mockExchangeCodeForSession = vi.fn();
    const mockSignInWithOAuth = vi.fn();
    // Use a stable object so useNavigation() returns the same reference
    // every call. Without this, LoginPanel's handleLogin re-creates on
    // every render, causing the useLayoutEffect/userEffect to re-fire
    // and creating an infinite re-render loop inside act().
    const stableNavigation = { navigate: mockNavigate, goBack: mockGoBack };
    return {
      mockNavigate,
      mockGoBack,
      mockSignInWithPassword,
      mockSignUp,
      mockResend,
      mockVerifyOtp,
      mockExchangeCodeForSession,
      mockSignInWithOAuth,
      stableNavigation,
    };
  },
);

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => stableNavigation,
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
      resend: mockResend,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
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
      resend: mockResend,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
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
    expect(findAllText(renderer, '카카오로 계속하기').length).toBeGreaterThan(0);
    expect(findAllText(renderer, '네이버로 계속하기').length).toBeGreaterThan(0);
    expect(findAllText(renderer, 'Apple로 계속하기').length).toBeGreaterThan(0);
  });

  it('renders email and password floating labels', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '이메일').length).toBeGreaterThan(0);
    expect(findAllText(renderer, '비밀번호').length).toBeGreaterThan(0);
  });

  it('does NOT wrap auth TextInputs in Pressable (regression: focus stealing / loop)', () => {
    const renderer = createTestRenderer();

    // No Pressable should wrap a TextInput. A Pressable wrapper around TextInput
    // caused two bugs on Android Fabric: on the login tab the focus jumped to
    // the next input then disappeared (keyboard flashed and dismissed), and on
    // the signup tab the three inputs entered an infinite focus loop. TextInput
    // must receive touches directly so it owns its own focus.
    const pressablesWithInput = renderer.root.findAllByType(Pressable).filter(
      (pressable) => pressable.findAllByType(TextInput).length > 0,
    );
    expect(pressablesWithInput).toHaveLength(0);

    // At least one TextInput must be rendered for auth fields.
    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders forgot password link', () => {
    const renderer = createTestRenderer();
    expect(findAllText(renderer, '비밀번호를 잊으셨나요?').length).toBeGreaterThan(0);
  });

  it('Android에서는 TextInput focus/blur로 키보드 상태를 추적한다', () => {
    const prevOS = Platform.OS;
    Platform.OS = 'android';
    try {
      const renderer = createTestRenderer();
      const inputs = renderer.root.findAllByType(TextInput);
      const emailInput = inputs.find((i) => i.props.accessibilityLabel === '이메일');
      const pwInput = inputs.find((i) => i.props.accessibilityLabel === '비밀번호');

      expect(emailInput?.props.onFocus).toBeTypeOf('function');
      expect(emailInput?.props.onBlur).toBeTypeOf('function');
      expect(pwInput?.props.onFocus).toBeTypeOf('function');
      expect(pwInput?.props.onBlur).toBeTypeOf('function');
    } finally {
      Platform.OS = prevOS;
    }
  });

  it('Android 로그인 입력 focus 시 고정 action bar를 렌더링한다', () => {
    const prevOS = Platform.OS;
    Platform.OS = 'android';
    try {
      const renderer = createTestRenderer();
      const emailInput = renderer.root.findAllByType(TextInput).find(
        (i) => i.props.accessibilityLabel === '이메일',
      );

      expect(renderer.root.findAllByProps({ testID: 'auth-action-bar' })).toHaveLength(0);
      expect(emailInput).toBeDefined();

      act(() => {
        emailInput!.props.onFocus();
      });

      const actionBar = renderer.root.findByProps({ testID: 'auth-action-bar' });
      // Email focused -> primary button reads "다음" (focus chaining)
      expect(actionBar.findByType(Pressable).props.accessibilityLabel).toBe('다음');
      expect(actionBar.findByType(Pressable).props.accessibilityState?.disabled).toBe(false);
    } finally {
      Platform.OS = prevOS;
    }
  });

  it('Android focus id는 중복 focus/blur와 전환에서 드리프트하지 않는다', () => {
    let focused: string | null = null;

    focused = nextFocusedInputId(focused, { type: 'focus', inputId: 'login-email' });
    focused = nextFocusedInputId(focused, { type: 'focus', inputId: 'login-email' });
    focused = nextFocusedInputId(focused, { type: 'blur', inputId: 'login-email' });
    expect(focused).toBeNull();

    focused = nextFocusedInputId(focused, { type: 'focus', inputId: 'login-email' });
    focused = nextFocusedInputId(focused, { type: 'focus', inputId: 'login-password' });
    focused = nextFocusedInputId(focused, { type: 'blur', inputId: 'login-email' });
    expect(focused).toBe('login-password');

    focused = nextFocusedInputId(focused, { type: 'reset' });
    expect(focused).toBeNull();
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
    expect(findAllText(renderer, '이메일 인증번호를 받을 기본 정보를 입력해주세요').length).toBeGreaterThan(0);

    // Labels are always visible (normal flow, not floating), so just verify
    // the confirm-password input exists and can accept text changes.
    const allInputs = renderer.root.findAllByType(TextInput);
    const pwConfirmInput = allInputs.find((i) => i.props.accessibilityLabel === '비밀번호 확인');
    expect(pwConfirmInput).toBeDefined();
    expect(typeof pwConfirmInput!.props.onChangeText).toBe('function');

    act(() => {
      pwConfirmInput!.props.onChangeText('test123!');
    });

    // The input should still be present and the label visible above it.
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
      // Focus password so the primary action reads "로그인" (not "다음")
      pwInput!.props.onFocus?.();
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

  it('sends email signup code and verifies the in-app code', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    const renderer = createTestRenderer();

    const signupTab = renderer.root.findAllByType(Pressable).find(
      (p) => p.props.accessibilityLabel === '회원가입 탭',
    );
    expect(signupTab).toBeDefined();

    act(() => {
      signupTab!.props.onPress();
    });

    const fillInput = (label: string, value: string) => {
      const input = renderer.root.findAllByType(TextInput).find(
        (i) => i.props.accessibilityLabel === label,
      );
      expect(input).toBeDefined();
      act(() => {
        input!.props.onChangeText(value);
      });
    };

    fillInput('이메일', 'new@example.com');
    fillInput('비밀번호 (8자 이상, 영문+숫자 포함)', 'password123');
    fillInput('비밀번호 확인', 'password123');

    act(() => {
      renderer.root.findAllByType(Pressable).find(
        (p) => p.props.accessibilityLabel === '다음 단계',
      )!.props.onPress();
    });

    fillInput('닉네임', '공구러');

    act(() => {
      renderer.root.findAllByType(Pressable).find(
        (p) => p.props.accessibilityLabel === '다음 단계',
      )!.props.onPress();
    });

    act(() => {
      renderer.root.findAllByType(Pressable).find(
        (p) => p.props.accessibilityLabel === '전체 동의하기',
      )!.props.onPress();
    });

    await act(async () => {
      renderer.root.findAllByType(Pressable).find(
        (p) => p.props.accessibilityLabel === '가입 완료',
      )!.props.onPress();
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: 'gongguwish://auth/callback',
        data: {
          nickname: '공구러',
          marketing_opt_in: true,
        },
      },
    });
    expect(findAllText(renderer, '이메일 인증').length).toBeGreaterThan(0);

    fillInput('인증번호', '123456');

    await act(async () => {
      renderer.root.findAllByType(Pressable).find(
        (p) => p.props.accessibilityLabel === '인증 완료',
      )!.props.onPress();
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'new@example.com',
      token: '123456',
      type: 'email',
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls signInWithOAuth with provider config when Kakao button pressed', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://auth.example/kakao' }, error: null });
    const renderer = createTestRenderer();

    const kakaoBtn = findPressableByText(renderer, '카카오로 계속하기');
    expect(kakaoBtn).toBeDefined();

    await act(async () => {
      kakaoBtn!.props.onPress();
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'gongguwish://auth/callback',
        skipBrowserRedirect: true,
      },
    });
  });

  it('calls signInWithOAuth when Apple login button pressed', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://auth.example/apple' }, error: null });
    const renderer = createTestRenderer();

    const appleBtn = findPressableByText(renderer, 'Apple로 계속하기');
    expect(appleBtn).toBeDefined();

    await act(async () => {
      appleBtn!.props.onPress();
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo: 'gongguwish://auth/callback',
        skipBrowserRedirect: true,
      },
    });
  });

  it('shows error text when social login fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });
    const renderer = createTestRenderer();

    const naverBtn = findPressableByText(renderer, '네이버로 계속하기');
    expect(naverBtn).toBeDefined();

    await act(async () => {
      naverBtn!.props.onPress();
    });

    expect(findAllText(renderer, '이메일 또는 비밀번호가 올바르지 않습니다.').length).toBeGreaterThan(0);
  });

  it('shows generic error on social login exception', async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error('Network error'));
    const renderer = createTestRenderer();

    const kakaoBtn = findPressableByText(renderer, '카카오로 계속하기');
    expect(kakaoBtn).toBeDefined();

    await act(async () => {
      kakaoBtn!.props.onPress();
    });

    expect(findAllText(renderer, '소셜 로그인에 실패했습니다.').length).toBeGreaterThan(0);
  });
});
