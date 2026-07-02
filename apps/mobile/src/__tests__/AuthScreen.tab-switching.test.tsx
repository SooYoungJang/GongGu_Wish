import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

(globalThis as any).__DEV__ = false;

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signUpWithEmailCode: vi.fn(),
  resendEmailSignUpCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

const navigationMock = vi.hoisted(() => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
}));

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  function AnimatedValue(this: any, value: number) {
    this._value = value;
    this.interpolate = vi.fn(() => 0);
  }

  return {
    Alert: { alert: vi.fn() },
    Animated: {
      Value: AnimatedValue,
      View: passthrough('View'),
      timing: () => ({ start: (cb?: () => void) => cb?.() }),
      loop: () => ({ start: vi.fn(), stop: vi.fn() }),
      sequence: () => ({ start: vi.fn(), stop: vi.fn() }),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Easing: { inOut: vi.fn(() => vi.fn()), sin: vi.fn() },
    Linking: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      getInitialURL: vi.fn(() => Promise.resolve(null)),
      openURL: vi.fn(() => Promise.resolve(true)),
    },
    Keyboard: {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    KeyboardAvoidingView: passthrough('KeyboardAvoidingView'),
    Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
    Pressable: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement('Pressable', { onPress, ...props }, children),
    ScrollView: passthrough('ScrollView'),
    StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => style },
    Text: passthrough('Text'),
    TextInput: ReactMock.forwardRef(({ children, ...props }: any, ref: React.Ref<unknown>) =>
      ReactMock.createElement('TextInput', { ref, ...props }, children),
    ),
    View: passthrough('View'),
  };
});

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => navigationMock,
  useRoute: () => ({ params: {} }),
}));

vi.mock('@react-navigation/native-stack', () => ({}));

vi.mock('react-native-keyboard-controller', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);
  return {
    KeyboardAwareScrollView: passthrough('KeyboardAwareScrollView'),
    KeyboardStickyView: passthrough('KeyboardStickyView'),
    KeyboardProvider: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement(React.Fragment, null, children),
    KeyboardAvoidingView: passthrough('KeyboardAvoidingView'),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textTertiary: '#999',
      border: '#ccc',
      error: '#f00',
    },
  }),
}));

vi.mock('../context/AuthContext', () => ({
  EMAIL_CODE_TTL_SECONDS: 300,
  useAuth: () => authMocks,
}));

vi.mock('../schemas/auth', () => ({
  loginSchema: { safeParse: vi.fn() },
  signupStep1Schema: { safeParse: vi.fn() },
  signupStep2Schema: { safeParse: vi.fn() },
  signupStep3Schema: { safeParse: vi.fn() },
  AGREEMENTS: [
    { key: 'agreeService', label: '서비스 이용약관', required: true },
    { key: 'agreePrivacy', label: '개인정보 수집 및 이용', required: true },
    { key: 'agreeAge', label: '만 14세 이상입니다', required: true },
    { key: 'agreeMarketing', label: '마케팅 정보 수신', required: false, detailLink: true },
  ],
}));

vi.mock('../utils/authHelpers', () => ({
  mapAuthErrorMessage: vi.fn(() => '오류가 발생했습니다. 다시 시도해주세요.'),
  getSocialProvidersForPlatform: vi.fn(() => [
    { provider: 'kakao', label: '카카오로 계속하기', icon: '💬', backgroundColor: '#FEE500', textColor: '#1a1a1a', accessibilityLabel: '카카오로 계속하기' },
    { provider: 'custom:naver', label: '네이버로 계속하기', icon: 'N', backgroundColor: '#03C75A', textColor: '#ffffff', accessibilityLabel: '네이버로 계속하기' },
    { provider: 'apple', label: 'Apple로 계속하기', icon: '', backgroundColor: '#000000', textColor: '#ffffff', accessibilityLabel: 'Apple로 계속하기' },
  ]),
}));

import { AuthScreen } from '../screens/AuthScreen';

function renderAuthScreen() {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<AuthScreen {...({} as any)} />);
  });
  return renderer!;
}

function containsText(renderer: TestRenderer.ReactTestRenderer, text: string): boolean {
  const root = renderer.root;
  const found = root.findAll((node) => {
    if (typeof node.type !== 'string') return false;
    const props = node.props as any;
    const children = props?.children;
    if (typeof children === 'string' && children.includes(text)) return true;
    if (Array.isArray(children)) {
      return children.some((c: any) => typeof c === 'string' && c.includes(text));
    }
    return false;
  });
  return found.length > 0;
}

function pressByAccessibilityLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const targets = renderer.root.findAll((node) => node.props.accessibilityLabel === label);
  expect(targets.length).toBeGreaterThan(0);
  act(() => {
    targets[0].props.onPress();
  });
}

describe('AuthScreen tab switching', () => {
  it('회원가입 탭 클릭 시 SignupPanel을 렌더링하고 로그인 탭으로 돌아올 수 있다', () => {
    const renderer = renderAuthScreen();

    // Initial state: LoginPanel should render the email login divider.
    expect(containsText(renderer, '또는 이메일 로그인')).toBe(true);

    // Press signup tab
    pressByAccessibilityLabel(renderer, '회원가입 탭');

    // SignupPanel should now show "기본 정보" (step 1 title)
    expect(containsText(renderer, '기본 정보')).toBe(true);

    // Press login tab
    pressByAccessibilityLabel(renderer, '로그인 탭');

    // LoginPanel should render again
    expect(containsText(renderer, '또는 이메일 로그인')).toBe(true);
  });
});
