import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as any).__DEV__ = false;

const authMocks = vi.hoisted(() => ({
  user: null,
  authCompletionRevision: 0,
  isLoading: false,
  isAudienceAuthIntentPending: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signUpWithEmailCode: vi.fn(),
  resendEmailSignUpCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signInWithOAuth: vi.fn(),
  startAudienceAuthIntent: vi.fn(),
  cancelAudienceAuthIntent: vi.fn(),
  takeAuthContinuation: vi.fn<
    () => (() => void | Promise<void>) | null
  >(() => null),
  clearAuthContinuation: vi.fn(),
}));

const audienceMocks = vi.hoisted(() => ({
  canAuthenticate: false,
  selectAgeBand: vi.fn(),
}));

const schemaMocks = vi.hoisted(() => ({
  loginSafeParse: vi.fn(),
  signupStep1SafeParse: vi.fn(),
  signupStep2SafeParse: vi.fn(),
}));

const navigationMock = vi.hoisted(() => ({
  addListener: vi.fn(),
  navigate: vi.fn(),
  goBack: vi.fn(),
  popTo: vi.fn(),
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

vi.mock("../audience/AudienceContext", () => ({
  useAudience: () => ({
    policy: { canAuthenticate: audienceMocks.canAuthenticate },
    selectAgeBand: audienceMocks.selectAgeBand,
  }),
}));

vi.mock("../schemas/auth", () => ({
  loginSchema: { safeParse: schemaMocks.loginSafeParse },
  signupStep1Schema: { safeParse: schemaMocks.signupStep1SafeParse },
  signupStep2Schema: { safeParse: schemaMocks.signupStep2SafeParse },
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

describe("AuthScreen tab switching", () => {
  beforeEach(() => {
    (authMocks as any).user = null;
    authMocks.authCompletionRevision = 0;
    authMocks.isLoading = false;
    authMocks.isAudienceAuthIntentPending = false;
    audienceMocks.canAuthenticate = false;
    audienceMocks.selectAgeBand.mockReset().mockResolvedValue(undefined);
    authMocks.signIn.mockReset().mockResolvedValue({ message: "로그인 실패" });
    authMocks.signInWithOAuth.mockReset().mockResolvedValue(null);
    authMocks.startAudienceAuthIntent.mockReset();
    authMocks.cancelAudienceAuthIntent.mockReset();
    authMocks.takeAuthContinuation.mockReset().mockReturnValue(null);
    authMocks.clearAuthContinuation.mockReset();
    authMocks.signUpWithEmailCode.mockReset().mockResolvedValue(null);
    authMocks.resendEmailSignUpCode.mockReset().mockResolvedValue(null);
    authMocks.verifyEmailCode.mockReset().mockResolvedValue(null);
    schemaMocks.loginSafeParse.mockReset().mockReturnValue({
      success: true,
      data: { email: "user@example.com", password: "password1" },
    });
    schemaMocks.signupStep1SafeParse.mockReset().mockReturnValue({
      success: true,
      data: {
        email: "new@example.com",
        password: "password1",
        confirmPassword: "password1",
      },
    });
    schemaMocks.signupStep2SafeParse.mockReset().mockReturnValue({
      success: true,
      data: { nickname: "공구러", phone: "" },
    });
    navigationMock.popTo.mockReset();
    navigationMock.goBack.mockReset();
    navigationMock.addListener.mockReset().mockReturnValue(vi.fn());
  });

  it("회원가입 탭 클릭 시 SignupPanel을 렌더링하고 로그인 탭으로 돌아올 수 있다", () => {
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

  it("로그인과 회원가입 탭 모두 소셜 인증 뒤에 체크박스 없는 약관 안내를 표시한다", () => {
    const renderer = renderAuthScreen();

    expect(containsText(renderer, "만 14세 이상")).toBe(true);
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.testID === "auth-legal-notice",
      ),
    ).toHaveLength(1);
    const loginNodes = renderer.root.findAll(() => true);
    const loginSocialButtonIndex = Math.max(
      ...loginNodes.map((node, index) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.endsWith("로 계속하기")
          ? index
          : -1,
      ),
    );
    const loginNoticeIndex = loginNodes.findIndex(
      (node) => node.props.testID === "auth-legal-notice",
    );
    const loginDividerIndex = loginNodes.findIndex(
      (node) => node.props.children === "또는 이메일 로그인",
    );

    expect(loginSocialButtonIndex).toBeGreaterThanOrEqual(0);
    expect(loginNoticeIndex).toBeGreaterThan(loginSocialButtonIndex);
    expect(loginNoticeIndex).toBeLessThan(loginDividerIndex);

    pressByAccessibilityLabel(renderer, "회원가입 탭");

    expect(containsText(renderer, "만 14세 이상")).toBe(true);
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.testID === "auth-legal-notice",
      ),
    ).toHaveLength(1);
    const signupNodes = renderer.root.findAll(() => true);
    const signupSocialButtonIndex = Math.max(
      ...signupNodes.map((node, index) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.endsWith("로 계속하기")
          ? index
          : -1,
      ),
    );
    const signupNoticeIndex = signupNodes.findIndex(
      (node) => node.props.testID === "auth-legal-notice",
    );
    const signupDividerIndex = signupNodes.findIndex(
      (node) => node.props.children === "또는 이메일 회원가입",
    );

    expect(signupSocialButtonIndex).toBeGreaterThanOrEqual(0);
    expect(signupNoticeIndex).toBeGreaterThan(signupSocialButtonIndex);
    expect(signupNoticeIndex).toBeLessThan(signupDividerIndex);
  });

  it.each([
    ["카카오로 계속하기", "kakao"],
    ["네이버로 계속하기", "custom:naver"],
    ["Apple로 계속하기", "apple"],
  ] as const)(
    "%s 인증은 연령 확인과 세션 복원이 끝난 뒤 한 번만 시작한다",
    async (label, provider) => {
      const renderer = renderAuthScreen();

      await act(async () => {
        await renderer.root
          .findByProps({ accessibilityLabel: label })
          .props.onPress();
      });

      expect(audienceMocks.selectAgeBand).toHaveBeenCalledWith("age14Plus");
      expect(authMocks.startAudienceAuthIntent).toHaveBeenCalledTimes(1);
      expect(authMocks.signInWithOAuth).not.toHaveBeenCalled();
      const signupTab = renderer.root.find(
        (node) =>
          typeof node.type === "string" &&
          node.props.accessibilityLabel === "회원가입 탭",
      );
      expect(signupTab.props.disabled).toBe(true);

      audienceMocks.canAuthenticate = true;
      authMocks.isLoading = true;
      await act(async () => {
        renderer.update(<AuthScreen {...({} as any)} />);
        await Promise.resolve();
      });

      expect(authMocks.signInWithOAuth).not.toHaveBeenCalled();

      authMocks.isLoading = false;
      await act(async () => {
        renderer.update(<AuthScreen {...({} as any)} />);
        await Promise.resolve();
      });

      expect(authMocks.signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(authMocks.signInWithOAuth).toHaveBeenCalledWith(provider);
    },
  );

  it("유효한 이메일 로그인도 연령 확인 상태가 반영된 뒤 실행한다", async () => {
    const renderer = renderAuthScreen();

    act(() => {
      renderer.root
        .findByProps({ testID: "fl-input-email" })
        .props.onChangeText("user@example.com");
      renderer.root
        .findByProps({ testID: "fl-input-password" })
        .props.onChangeText("password1");
    });
    await act(async () => {
      await renderer.root
        .findByProps({ testID: "auth-login-submit" })
        .props.onPress();
    });

    expect(audienceMocks.selectAgeBand).toHaveBeenCalledWith("age14Plus");
    expect(authMocks.signIn).not.toHaveBeenCalled();

    audienceMocks.canAuthenticate = true;
    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
    });

    expect(authMocks.signIn).toHaveBeenCalledTimes(1);
    expect(authMocks.signIn).toHaveBeenCalledWith(
      "user@example.com",
      "password1",
    );
  });

  it("현재 인증 의도와 무관한 user로는 마이페이지에 이동하지 않는다", async () => {
    const renderer = renderAuthScreen();

    await act(async () => {
      await renderer.root
        .findByProps({
          accessibilityLabel: "카카오로 계속하기",
        })
        .props.onPress();
    });

    authMocks.isAudienceAuthIntentPending = true;
    audienceMocks.canAuthenticate = true;
    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
    });

    (authMocks as any).user = { id: "stale-user" };
    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
    });
    expect(navigationMock.popTo).not.toHaveBeenCalled();

    authMocks.isAudienceAuthIntentPending = false;
    (authMocks as any).user = { id: "selected-user" };
    authMocks.authCompletionRevision = 1;
    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
    });
    expect(navigationMock.popTo).toHaveBeenCalledWith("MainTabs", {
      screen: "MyPage",
    });
  });

  it("resumes the pending notification action before returning to the previous screen", async () => {
    const continuation = vi.fn().mockResolvedValue(undefined);
    const renderer = renderAuthScreen();

    (authMocks as any).user = { id: "selected-user" };
    authMocks.authCompletionRevision = 1;
    authMocks.takeAuthContinuation.mockReturnValueOnce(continuation);

    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(continuation).toHaveBeenCalledOnce();
    expect(navigationMock.goBack).toHaveBeenCalledOnce();
    expect(navigationMock.popTo).not.toHaveBeenCalled();
  });

  it("returns after a pending action throws synchronously", async () => {
    const continuation = vi.fn(() => {
      throw new Error("resume failed");
    });
    const renderer = renderAuthScreen();

    (authMocks as any).user = { id: "selected-user" };
    authMocks.authCompletionRevision = 1;
    authMocks.takeAuthContinuation.mockReturnValueOnce(continuation);

    await act(async () => {
      renderer.update(<AuthScreen {...({} as any)} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(continuation).toHaveBeenCalledOnce();
    expect(navigationMock.goBack).toHaveBeenCalledOnce();
  });

  it("이미 로그인된 user로 인증 화면이 마운트돼도 자동 이동하지 않는다", () => {
    (authMocks as any).user = { id: "existing-user" };
    authMocks.authCompletionRevision = 4;

    renderAuthScreen();

    expect(navigationMock.popTo).not.toHaveBeenCalled();
  });

  it("인증 화면을 벗어나면 대기 중인 인증 의도를 취소한다", () => {
    renderAuthScreen();

    const beforeRemoveListener = navigationMock.addListener.mock.calls.find(
      ([event]) => event === "beforeRemove",
    )?.[1];
    expect(beforeRemoveListener).toBeTypeOf("function");

    act(() => beforeRemoveListener());

    expect(authMocks.cancelAudienceAuthIntent).toHaveBeenCalledTimes(1);
  });

  it("유효하지 않은 이메일 로그인은 연령 확인도 인증도 시작하지 않는다", async () => {
    schemaMocks.loginSafeParse.mockReturnValueOnce({
      success: false,
      error: {
        issues: [
          { path: ["email"], message: "올바른 이메일 형식이 아닙니다." },
        ],
      },
    });
    const renderer = renderAuthScreen();

    await act(async () => {
      await renderer.root
        .findByProps({ testID: "auth-login-submit" })
        .props.onPress();
    });

    expect(audienceMocks.selectAgeBand).not.toHaveBeenCalled();
    expect(authMocks.startAudienceAuthIntent).not.toHaveBeenCalled();
    expect(authMocks.signIn).not.toHaveBeenCalled();
    expect(
      renderer.root.findAll((node) => node.props.accessibilityRole === "alert")
        .length,
    ).toBeGreaterThan(0);
  });

  it("이메일 회원가입은 필수 약관 단계 없이 선택 마케팅만 남긴다", () => {
    const renderer = renderAuthScreen();

    pressByAccessibilityLabel(renderer, "회원가입 탭");
    pressByAccessibilityLabel(renderer, "다음 단계");

    const checkboxes = renderer.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityRole === "checkbox",
    );
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0].props.accessibilityLabel).toBe(
      "마케팅 정보 수신 동의 (선택)",
    );
    expect(containsText(renderer, "약관 동의")).toBe(false);
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.accessibilityLabel === "가입하기",
      ),
    ).toHaveLength(1);
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    "이메일 회원가입은 마케팅 선택값 %s만 metadata에 보낸다",
    async (optIn, expected) => {
      const renderer = renderAuthScreen();
      pressByAccessibilityLabel(renderer, "회원가입 탭");
      act(() => {
        renderer.root
          .findByProps({ testID: "signup-input-email" })
          .props.onChangeText("new@example.com");
        renderer.root
          .findByProps({ testID: "signup-input-password" })
          .props.onChangeText("password1");
        renderer.root
          .findByProps({ testID: "signup-input-confirm-password" })
          .props.onChangeText("password1");
      });
      pressByAccessibilityLabel(renderer, "다음 단계");
      act(() => {
        renderer.root
          .findByProps({ testID: "signup-input-nickname" })
          .props.onChangeText("공구러");
      });
      if (optIn) {
        pressByAccessibilityLabel(renderer, "마케팅 정보 수신 동의 (선택)");
      }

      await act(async () => {
        const submit = renderer.root.find(
          (node) =>
            typeof node.type === "string" &&
            node.props.accessibilityLabel === "가입하기",
        );
        await submit.props.onPress();
      });

      expect(authMocks.signUpWithEmailCode).not.toHaveBeenCalled();
      audienceMocks.canAuthenticate = true;
      await act(async () => {
        renderer.update(<AuthScreen {...({} as any)} />);
        await Promise.resolve();
      });

      expect(authMocks.signUpWithEmailCode).toHaveBeenCalledWith(
        "new@example.com",
        "password1",
        {
          nickname: "공구러",
          marketing_opt_in: expected,
        },
      );
    },
  );
});
