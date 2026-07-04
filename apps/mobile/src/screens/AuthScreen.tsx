/**
 * AuthScreen — Coral Wave Redesign v2 (Refined)
 *
 * Refined Coral Wave design — balances brand identity with app consistency:
 *  - Warm beige (#f5f0eb) background kept as brand signature
 *  - Underline-style tabs (was segment control) for cleaner look
 * *  - Subtle wave decoration (reduced height, softer opacity)
 *  - Rounded corners unified to 14px throughout
 *
 * Single-page Login / Signup screen with:
 *  - Tab switching (Login ↔ Signup)
 *  - Social login buttons (Android: Kakao / Naver, iOS: Kakao / Naver / Apple)
 *  - Floating label inputs with Zod validation
 *  - Password visibility toggle & "Forgot password" link
 *  - 3-step Progressive Disclosure for signup
 *  - Agreement checkboxes (all-agree + required/optional)
 *  - Responsive (mobile-first) + WCAG AA accessibility
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EMAIL_CODE_TTL_SECONDS, useAuth } from '../context/AuthContext';
import { GoBackHeader } from '../components/GoBackHeader';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import {
  loginSchema,
  signupStep1Schema,
  signupStep2Schema,
  signupStep3Schema,
  AGREEMENTS,
  type LoginForm,
  type SignupStep1Form,
  type SignupStep2Form,
  type SignupStep3Form,
} from '../schemas/auth';
import {
  getSocialProvidersForPlatform,
  mapAuthErrorMessage,
  type SocialAuthProvider,
} from '../utils/authHelpers';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthTab = 'login' | 'signup';
type SignupStep = 1 | 2 | 3 | 4;

type FocusEvent = { type: 'focus'; inputId: string } | { type: 'blur'; inputId: string } | { type: 'reset' };

export function nextFocusedInputId(current: string | null, event: FocusEvent): string | null {
  if (event.type === 'focus') return event.inputId;
  if (event.type === 'reset') return null;
  return current === event.inputId ? null : current;
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

// ─── Action Bar Config ─────────────────────────────────────────────────────

type ActionBarItem = {
  text: string;
  onPress: () => void;
  disabled: boolean;
};

type ActionBarConfig = {
  variant: 'login' | 'signup';
  primary: ActionBarItem;
  secondary?: ActionBarItem;
};


const makeStyles = (colors: CommerceColorPalette) =>
  StyleSheet.create({
    // Container
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    authScrollContent: {
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 120,
    },
    actionBarArea: {
      backgroundColor: colors.bg,
      paddingHorizontal: 24,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    actionBarInner: {
      flexDirection: 'row',
      gap: 10,
    },

    // Header — refined coral wave
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    appName: {
      fontWeight: '800',
      fontSize: 22,
      color: colors.text,
      letterSpacing: -0.5,
    },
    appNameAccent: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 22,
    },
    welcomeText: {
      fontWeight: '400',
      fontSize: 14,
      color: colors.muted,
      marginTop: 6,
      letterSpacing: -0.2,
    },

    // Tab bar — refined underline style (coral wave v2)
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 2,
      borderBottomColor: colors.borderLight,
      marginBottom: 28,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -2,
    },
    tabBtnActive: {
      borderBottomColor: colors.accent,
    },
    tabBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.muted,
    },
    tabBtnTextActive: {
      color: colors.accent,
    },

    // Social section — refined (no title, cleaner)
    socialSection: {
      gap: 10,
      marginBottom: 20,
    },

    // Divider
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.softBg,
    },
    dividerText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '500',
    },

    // CTA Button — refined coral wave
    ctaBtn: {
      width: '100%',
      height: 54,
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    ctaBtnText: {
      color: colors.inverse,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    ctaBtnPressed: {
      opacity: 0.85,
    },
    ctaBtnDisabled: {
      opacity: 0.6,
    },

    // Password options
    pwOptions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    forgotLink: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.muted,
    },

    // ── Signup Steps ──

    stepProgress: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 24,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.softBg,
    },
    stepDotActive: {
      backgroundColor: colors.accent,
      width: 28,
      borderRadius: 4,
    },
    stepDotDone: {
      backgroundColor: colors.success,
    },
    stepTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    stepDesc: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 20,
      letterSpacing: -0.2,
    },
    stepNav: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    stepNavBtn: {
      flex: 1,
      height: 48,
      borderRadius: commerceRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNavBtnPrimary: {
      backgroundColor: colors.accent,
      borderWidth: 0,
    },
    stepNavBtnPrimaryText: {
      color: colors.inverse,
      fontSize: 14,
      fontWeight: '600',
    },
    stepNavBtnSecondary: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    stepNavBtnSecondaryText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
    },
    btnPressed: {
      opacity: 0.8,
    },

    // ── Agreement ──

    agreeGroup: {
      gap: 12,
      marginBottom: 20,
    },
    agreeAll: {
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    agreeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkmark: {
      color: colors.inverse,
      fontSize: 13,
      fontWeight: '700',
    },
    agreeLabelAll: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    agreeLabelBold: {
      fontWeight: '700',
    },
    agreeLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      letterSpacing: -0.2,
    },
    agreeDetail: {
      fontSize: 12,
      color: colors.muted,
    },

    // ── Social Button Styles ──

    appleIcon: {
      fontSize: 22,
    },
    googleIcon: {
      fontWeight: '700',
      fontSize: 16,
      color: '#4285F4',
    },

    // Social buttons
    socialBtn: {
      height: 52,
      borderRadius: commerceRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    socialBtnPressed: {
      opacity: 0.85,
    },
    socialBtnDisabled: {
      opacity: 0.5,
    },
    socialIcon: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    socialLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.3,
      paddingRight: 28,
    },

    // ── Theme-dependent helpers (formerly local makeStyles) ──

    pwToggle: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      padding: 4,
    },
    pwToggleIcon: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.weak,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
    },
  });

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AuthScreen(_props: AuthScreenProps) {
  const { colors } = useCommerceTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  const [actionBar, setActionBar] = useState<ActionBarConfig | null>(null);
  const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
  const [authRuntimeMarker] = useState(() => `gon-211-${Date.now()}`);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Reset focus state on tab switch; child panels own actionBar reporting.
  useEffect(() => {
    setFocusedInputId((current) => nextFocusedInputId(current, { type: 'reset' }));
  }, [activeTab]);

  // ponytail: Keyboard events are the primary visibility signal on Android.
  // focusedInputId from onFocus/onBlur is the fallback — covers the gap before
  // keyboardDidShow fires, and the rare case where onFocus fires without keyboard.
  // On keyboardDidHide (back button dismiss on Android) focusedInputId is cleared
  // because onBlur doesn't fire in that path. Upgrade: per-input tracking if needed.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setFocusedInputId(null);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(`[AuthScreen] GON-211 runtime marker: ${authRuntimeMarker}`);
    }
  }, [authRuntimeMarker]);

  // ── Scroll-to-input for keyboard avoidance ─────────────────────────────
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(`[AuthScreen] actionBar: ${actionBar ? JSON.stringify({primary: actionBar.primary.text, secondary: actionBar.secondary?.text}) : 'null'}`);
    }
  }, [actionBar]);

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(`[AuthScreen] focusedInputId: ${focusedInputId}`);
    }
  }, [focusedInputId]);

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(`[AuthScreen] keyboardVisible: ${keyboardVisible}`);
    }
  }, [keyboardVisible]);

  const shouldShowStickyAction = focusedInputId !== null || keyboardVisible;
  const onInputFocus = useCallback((inputId: string) => {
    setFocusedInputId(inputId);
  }, []);
  const onInputBlur = useCallback((inputId: string) => {
    setFocusedInputId((current) => (current === inputId ? null : current));
  }, []);

  // ponytail: fallback config — covers the async gap before LoginPanel's
  // useEffect fires onActionBarChange. On the login tab the action is always
  // "로그인", so we can show a disabled placeholder instead of nothing.
  // On signup the config depends on the current step so no fallback.
  const resolvedActionBar: ActionBarConfig | null = useMemo(() => {
    if (actionBar) return actionBar;
    if (activeTab !== 'login' || !shouldShowStickyAction) return null;
    return { variant: 'login', primary: { text: '로그인', onPress: () => {}, disabled: true } };
  }, [actionBar, activeTab, shouldShowStickyAction]);

  // ponytail: GON-211 — tracking when actionBar is null but keyboard is visible
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      if (shouldShowStickyAction && !actionBar) {
        console.warn('[AuthScreen] keyboard visible but actionBar null — fallback used');
      }
    }
  }, [shouldShowStickyAction, actionBar]);

  const stickyFooter = resolvedActionBar && shouldShowStickyAction ? (
    <ActionBarArea
      config={resolvedActionBar}
      bottomInset={insets.bottom}
    />
  ) : null;

  return (
    <View
      style={styles.container}
      accessibilityLabel="공구위시 로그인 화면"
      testID={`auth-screen-${authRuntimeMarker}`}
    >
      <GoBackHeader />
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <KeyboardFormScreen
          footer={stickyFooter}
          contentContainerStyle={styles.authScrollContent}
        >
          <AuthHeader />
          <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <AuthContentArea
            activeTab={activeTab}
            onActionBarChange={setActionBar}
            hideActions={shouldShowStickyAction}
            onInputFocus={onInputFocus}
            onInputBlur={onInputBlur}
          />
        </KeyboardFormScreen>
      </View>
    </View>
  );
}

// ─── Header: App Name + Welcome ─────────────────────────────────────────────

function AuthHeader() {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.header} accessible accessibilityLabel="공구위시">
      <Text style={styles.appName}>
        공구<Text style={styles.appNameAccent}>위시</Text>
      </Text>
      <Text style={styles.welcomeText}>함께 사면 더 즐거운 공동구매</Text>
    </View>
  );
}

// ─── Tab Bar: Login / Signup ────────────────────────────────────────────────

function AuthTabs({ activeTab, onTabChange }: { activeTab: AuthTab; onTabChange: (tab: AuthTab) => void }) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const switchTab = useCallback((tab: AuthTab) => {
    onTabChange(tab);
  }, [onTabChange]);

  return (
    <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="인증 방식 선택">
      <Pressable
        accessible
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'login' }}
        accessibilityLabel="로그인 탭"
        accessibilityHint="이메일로 로그인합니다"
        onPress={() => switchTab('login')}
        style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
      >
        <Text style={[styles.tabBtnText, activeTab === 'login' && styles.tabBtnTextActive]}>
          로그인
        </Text>
      </Pressable>
      <Pressable
        accessible
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'signup' }}
        accessibilityLabel="회원가입 탭"
        accessibilityHint="새 계정을 만듭니다"
        onPress={() => switchTab('signup')}
        style={[styles.tabBtn, activeTab === 'signup' && styles.tabBtnActive]}
      >
        <Text style={[styles.tabBtnText, activeTab === 'signup' && styles.tabBtnTextActive]}>
          회원가입
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Auth Content Area ──────────────────────────────────────────────────────

function AuthContentArea({ activeTab, onActionBarChange, hideActions, onInputFocus, onInputBlur }: {
  activeTab: AuthTab;
  onActionBarChange?: (config: ActionBarConfig) => void;
  hideActions?: boolean;
  onInputFocus?: (inputId: string) => void;
  onInputBlur?: (inputId: string) => void;
}) {
  return (
    <View>
      {activeTab === 'login' ? (
        <LoginPanel onActionBarChange={onActionBarChange} hideActions={hideActions} onInputFocus={onInputFocus} onInputBlur={onInputBlur} />
      ) : (
        <SignupPanel onActionBarChange={onActionBarChange} hideActions={hideActions} onInputFocus={onInputFocus} onInputBlur={onInputBlur} />
      )}
    </View>
  );
}

// ─── Login Panel ────────────────────────────────────────────────────────────

function LoginPanel({ onActionBarChange, hideActions, onInputFocus, onInputBlur }: {
  onActionBarChange?: (config: ActionBarConfig) => void;
  hideActions?: boolean;
  onInputFocus?: (inputId: string) => void;
  onInputBlur?: (inputId: string) => void;
}) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signInWithOAuth } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [focusedLoginField, setFocusedLoginField] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<string | null>(null);
  const socialProviders = useMemo(() => getSocialProvidersForPlatform(), []);

  const handleLogin = useCallback(async () => {
    setSubmitError(null);
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const authError = await signIn(result.data.email, result.data.password);
      if (authError) {
        setSubmitError(mapAuthErrorMessage(authError));
      } else {
        navigation.goBack();
      }
    } catch {
      setSubmitError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signIn, navigation]);

  const handleForgotPassword = useCallback(() => {
    Alert.alert('준비중', '비밀번호 찾기 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.');
  }, []);

  const handleLoginPrimaryAction = useCallback(() => {
    if (focusedLoginField === 'login-email') {
      if (!email.trim()) {
        setErrors((prev) => ({ ...prev, email: '이메일을 입력해주세요.' }));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
        setErrors((prev) => ({ ...prev, email: '올바른 이메일 형식이 아닙니다.' }));
        return;
      }
      setErrors((prev) => ({ ...prev, email: '' }));
      passwordRef.current?.focus();
      return;
    }

    handleLogin();
  }, [focusedLoginField, email, handleLogin]);

  const handleSocialLogin = useCallback(
    async (provider: SocialAuthProvider) => {
      setSocialSubmitting(provider);
      setSubmitError(null);
      try {
        const error = await signInWithOAuth(provider);
        if (error) {
          setSubmitError(mapAuthErrorMessage(error));
        }
        // OAuth redirect will handle navigation; no goBack() needed
      } catch {
        setSubmitError('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setSocialSubmitting(null);
      }
    },
    [signInWithOAuth],
  );

  // ── Report action bar config ─────────────────────────────────────────
  useEffect(() => {
    const primaryText =
      focusedLoginField === 'login-email'
        ? '다음'
        : (submitting ? '로그인 중...' : '로그인');

    onActionBarChange?.({
      variant: 'login',
      primary: {
        text: primaryText,
        onPress: handleLoginPrimaryAction,
        disabled: submitting,
      },
    });
  }, [submitting, focusedLoginField, handleLoginPrimaryAction, onActionBarChange]);

  return (
    <View accessibilityLabel="로그인">
      {/* Social Login — refined: no title */}
      <View style={styles.socialSection}>
        {socialProviders.map((sp) => (
          <SocialButton
            key={sp.provider}
            label={sp.label}
            icon={sp.icon}
            backgroundColor={sp.backgroundColor}
            textColor={sp.textColor}
            borderColor={sp.borderColor}
            iconStyle={sp.iconStyle as TextStyle}
            accessibilityLabel={sp.accessibilityLabel}
            onPress={() => handleSocialLogin(sp.provider)}
            disabled={socialSubmitting !== null}
          />
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} accessible accessibilityRole="none">
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는 이메일 로그인</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email Form */}
      <View>
        <AuthInput
          label="이메일"
          testID="fl-input-email"
          ref={emailRef}
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          error={errors.email}
          editable={!submitting}
          focusId="login-email"
          onAuthInputFocus={(id) => { setFocusedLoginField(id); onInputFocus?.(id); }}
          onAuthInputBlur={(id) => { setFocusedLoginField((cur) => (cur === id ? null : cur)); onInputBlur?.(id); }}
        />
        <AuthInput
          label="비밀번호"
          testID="fl-input-password"
          ref={passwordRef}
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          error={errors.password}
          editable={!submitting}
          focusId="login-password"
          onAuthInputFocus={(id) => { setFocusedLoginField(id); onInputFocus?.(id); }}
          onAuthInputBlur={(id) => { setFocusedLoginField((cur) => (cur === id ? null : cur)); onInputBlur?.(id); }}
          rightElement={
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((p) => !p)}
              style={styles.pwToggle}
              hitSlop={8}
            >
              <Text style={styles.pwToggleIcon}>
                {showPassword ? '숨김' : '표시'}
              </Text>
            </Pressable>
          }
        />

        <View style={styles.pwOptions}>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="비밀번호 찾기"
            onPress={handleForgotPassword}
            hitSlop={8}
          >
            <Text style={styles.forgotLink}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
        </View>

        {submitError ? (
          <Text style={[styles.errorText, { marginBottom: 12, marginTop: 4 }]}>
            {submitError}
          </Text>
        ) : null}

        {!hideActions && (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="로그인"
            accessibilityState={{ disabled: submitting }}
            onPress={handleLogin}
            disabled={submitting}
            style={({ pressed }) => [
              styles.ctaBtn,
              submitting && styles.ctaBtnDisabled,
              pressed && !submitting && styles.ctaBtnPressed,
            ]}
          >
            <Text style={styles.ctaBtnText}>
              {submitting ? '로그인 중...' : '로그인'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Signup Panel (3-Step Progressive Disclosure) ──────────────────────────

function SignupPanel({ onActionBarChange, hideActions, onInputFocus, onInputBlur }: {
  onActionBarChange?: (config: ActionBarConfig) => void;
  hideActions?: boolean;
  onInputFocus?: (inputId: string) => void;
  onInputBlur?: (inputId: string) => void;
}) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    resendEmailSignUpCode,
    signInWithOAuth,
    signUpWithEmailCode,
    verifyEmailCode,
  } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<SignupStep>(1);
  const socialProviders = useMemo(() => getSocialProvidersForPlatform(), []);

  // Step 1 input refs for focus chaining
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Track which step-1 field currently has focus so the "다음" button can
  // advance focus to the next field instead of jumping straight to step 2.
  const [focusedStep1Field, setFocusedStep1Field] = useState<string | null>(null);

  // Step 1 state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof SignupStep1Form, string>>>({});

  // Step 2 state
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [step2Errors, setStep2Errors] = useState<Partial<Record<keyof SignupStep2Form, string>>>({});

  // Step 3 state
  const [agreements, setAgreements] = useState<Record<string, boolean>>({
    agreeAll: false,
    agreeService: false,
    agreePrivacy: false,
    agreeMarketing: false,
    agreeAge: false,
  });
  const [step3Errors, setStep3Errors] = useState<Partial<Record<keyof SignupStep3Form, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EMAIL_CODE_TTL_SECONDS);

  useEffect(() => {
    if (step !== 4 || !codeExpiresAt) return undefined;

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000)));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [step, codeExpiresAt]);

  const startEmailCodeTimer = useCallback(() => {
    setCodeExpiresAt(Date.now() + EMAIL_CODE_TTL_SECONDS * 1000);
    setSecondsLeft(EMAIL_CODE_TTL_SECONDS);
  }, []);

  // ── Step navigation ─────────────────────────────────────────────────────

  const goToNextStep = useCallback(() => {
    if (step === 1) {
      const result = signupStep1Schema.safeParse({ email, password, confirmPassword });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string;
          if (!fieldErrors[field]) {
            fieldErrors[field] = issue.message;
          }
        }
        setStep1Errors(fieldErrors);
        return;
      }
      setStep1Errors({});
      setStep(2);
    } else if (step === 2) {
      const result = signupStep2Schema.safeParse({ nickname, phone });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as string;
          if (!fieldErrors[field]) {
            fieldErrors[field] = issue.message;
          }
        }
        setStep2Errors(fieldErrors);
        return;
      }
      setStep2Errors({});
      setStep(3);
    }
  }, [step, email, password, confirmPassword, nickname, phone]);

  const goToPrevStep = useCallback((target: SignupStep) => {
    setStep(target);
  }, []);

  // Step 1: focus the next field, or advance to step 2 from the last field.
  // Ordered list maps focusId -> next ref.
  const step1Fields = useMemo(
    () => [
      { id: 'signup-email', ref: emailRef },
      { id: 'signup-password', ref: passwordRef },
      { id: 'signup-confirm-password', ref: confirmPasswordRef },
    ],
    [],
  );

  // Per-field validation for step 1 focus chaining.
  // Returns an error message string, or null if the field is valid.
  const validateStep1Field = useCallback((index: number): string | null => {
    if (index === 0) {
      if (!email.trim()) return '이메일을 입력해주세요.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
        return '올바른 이메일 형식이 아닙니다.';
      }
      return null;
    }
    if (index === 1) {
      if (!password) return '비밀번호를 입력해주세요.';
      if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
      if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) return '비밀번호는 영문과 숫자를 포함해야 합니다.';
      return null;
    }
    if (index === 2) {
      if (!confirmPassword) return '비밀번호를 다시 입력해주세요.';
      if (password !== confirmPassword) return '비밀번호가 일치하지 않습니다.';
      return null;
    }
    return null;
  }, [email, password, confirmPassword]);

  const handleStep1Next = useCallback(() => {
    // Per-field validation before advancing focus.  If the focused field
    // fails its check, show the error and stay put.
    // Prefer the live ref's isFocused() to avoid the blur race (pressing the
    // sticky action bar can blur the input before onPress runs); fall back to
    // the tracked focusedStep1Field state so chaining still works.
    let currentIndex = step1Fields.findIndex((f) => f.ref.current?.isFocused());
    if (currentIndex < 0) {
      currentIndex = step1Fields.findIndex((f) => f.id === focusedStep1Field);
    }

    if (currentIndex >= 0 && currentIndex < step1Fields.length - 1) {
      const error = validateStep1Field(currentIndex);
      if (error) {
        const fieldKey = step1Fields[currentIndex].id.replace('signup-', '') as keyof SignupStep1Form;
        setStep1Errors((prev) => ({ ...prev, [fieldKey]: error }));
        return;
      }
      // Clear error for this field and focus the next one.
      const fieldKey = step1Fields[currentIndex].id.replace('signup-', '') as keyof SignupStep1Form;
      setStep1Errors((prev) => ({ ...prev, [fieldKey]: '' }));
      step1Fields[currentIndex + 1].ref.current?.focus();
      return;
    }
    // Last field (or no focus): validate and advance.
    goToNextStep();
  }, [step1Fields, goToNextStep, email, password, confirmPassword, validateStep1Field, focusedStep1Field]);

  // ── Agreement handling ───────────────────────────────────────────────────

  const toggleAllAgree = useCallback((checked: boolean) => {
    setAgreements((prev) => ({
      ...prev,
      agreeAll: checked,
      agreeService: checked,
      agreePrivacy: checked,
      agreeMarketing: checked,
      agreeAge: checked,
    }));
  }, []);

  const toggleAgree = useCallback((key: string, checked: boolean) => {
    setAgreements((prev) => {
      const next = { ...prev, [key]: checked };
      const requiredKeys = AGREEMENTS.filter((a) => a.required).map((a) => a.key);
      const allRequiredChecked = requiredKeys.every((k) => next[k] === true);
      next.agreeAll = allRequiredChecked;
      return next;
    });
  }, []);

  const handleSocialSignup = useCallback(
    async (provider: SocialAuthProvider) => {
      setSocialSubmitting(provider);
      setSubmitError(null);
      try {
        const error = await signInWithOAuth(provider);
        if (error) {
          setSubmitError(mapAuthErrorMessage(error));
        }
      } catch {
        setSubmitError('소셜 회원가입에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setSocialSubmitting(null);
      }
    },
    [signInWithOAuth],
  );

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleCompleteSignup = useCallback(async () => {
    setSubmitError(null);
    const agreeData: Record<string, boolean> = {};
    for (const a of AGREEMENTS) {
      agreeData[a.key] = agreements[a.key] ?? false;
    }
    const result = signupStep3Schema.safeParse(agreeData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setStep3Errors(fieldErrors);
      return;
    }
    setStep3Errors({});

    setSubmitting(true);
    try {
      const metadata = {
        nickname,
        ...(phone ? { phone } : {}),
        marketing_opt_in: agreements.agreeMarketing === true,
      };
      const authError = await signUpWithEmailCode(email, password, metadata);
      if (authError) {
        setSubmitError(mapAuthErrorMessage(authError));
      } else {
        setVerificationCode('');
        setVerificationError(null);
        startEmailCodeTimer();
        setStep(4);
      }
    } catch {
      setSubmitError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, nickname, phone, agreements, signUpWithEmailCode, startEmailCodeTimer]);

  const handleVerifyEmailCode = useCallback(async () => {
    setVerificationError(null);
    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setVerificationError('6자리 인증번호를 입력해주세요.');
      return;
    }
    if (secondsLeft <= 0) {
      setVerificationError('인증번호가 만료되었습니다. 다시 발송해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const authError = await verifyEmailCode(email, code);
      if (authError) {
        setVerificationError(mapAuthErrorMessage(authError));
      } else {
        navigation.goBack();
      }
    } catch {
      setVerificationError('인증번호 확인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [email, navigation, secondsLeft, verificationCode, verifyEmailCode]);

  const handleResendEmailCode = useCallback(async () => {
    setVerificationError(null);
    setSubmitting(true);
    try {
      const authError = await resendEmailSignUpCode(email);
      if (authError) {
        setVerificationError(mapAuthErrorMessage(authError));
      } else {
        setVerificationCode('');
        startEmailCodeTimer();
      }
    } catch {
      setVerificationError('인증번호 재발송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [email, resendEmailSignUpCode, startEmailCodeTimer]);

  // ── Report action bar config ─────────────────────────────────────────
  useEffect(() => {
    if (step === 1) {
      onActionBarChange?.({
        variant: 'signup',
        primary: { text: '다음', onPress: handleStep1Next, disabled: submitting },
      });
    } else if (step === 2) {
      onActionBarChange?.({
        variant: 'signup',
        primary: { text: '다음', onPress: goToNextStep, disabled: submitting },
        secondary: { text: '이전', onPress: () => goToPrevStep(1), disabled: submitting },
      });
    } else if (step === 3) {
      onActionBarChange?.({
        variant: 'signup',
        primary: {
          text: submitting ? '가입 처리 중...' : '가입 완료',
          onPress: handleCompleteSignup,
          disabled: submitting,
        },
        secondary: { text: '이전', onPress: () => goToPrevStep(2), disabled: submitting },
      });
    } else if (step === 4) {
      onActionBarChange?.({
        variant: 'signup',
        primary: {
          text: submitting ? '확인 중...' : '인증 완료',
          onPress: handleVerifyEmailCode,
          disabled: submitting || verificationCode.trim().length < 6 || secondsLeft <= 0,
        },
        secondary: { text: '재발송', onPress: handleResendEmailCode, disabled: submitting },
      });
    }
  }, [
    step,
    submitting,
    goToNextStep,
    handleStep1Next,
    goToPrevStep,
    handleCompleteSignup,
    handleVerifyEmailCode,
    handleResendEmailCode,
    verificationCode,
    secondsLeft,
    onActionBarChange,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View accessibilityLabel="회원가입">
      <View style={styles.socialSection}>
        {socialProviders.map((sp) => (
          <SocialButton
            key={sp.provider}
            label={sp.label}
            icon={sp.icon}
            backgroundColor={sp.backgroundColor}
            textColor={sp.textColor}
            borderColor={sp.borderColor}
            iconStyle={sp.iconStyle as TextStyle}
            accessibilityLabel={sp.accessibilityLabel}
            onPress={() => handleSocialSignup(sp.provider)}
            disabled={socialSubmitting !== null || submitting}
          />
        ))}
      </View>

      <View style={styles.divider} accessible accessibilityRole="none">
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는 이메일 회원가입</Text>
        <View style={styles.dividerLine} />
      </View>

      {submitError ? (
        <Text style={[styles.errorText, { marginBottom: 12 }]}>
          {submitError}
        </Text>
      ) : null}

      {/* Step Progress */}
      <View
        style={styles.stepProgress}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ now: step, min: 1, max: 4 }}
        accessibilityLabel="회원가입 진행 단계"
      >
        {([1, 2, 3, 4] as const).map((s) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              step > s && styles.stepDotDone,
            ]}
          />
        ))}
      </View>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <View accessibilityLabel="1단계: 기본 정보">
          <Text style={styles.stepTitle}>기본 정보</Text>
          <Text style={styles.stepDesc}>이메일 인증번호를 받을 기본 정보를 입력해주세요</Text>

          <AuthInput
            label="이메일"
            testID="signup-input-email"
            ref={emailRef}
            value={email}
            onChangeText={(t) => { setEmail(t); setStep1Errors((e) => ({ ...e, email: '' })); }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            error={step1Errors.email}
            editable={!submitting}
            focusId="signup-email"
            onAuthInputFocus={(id) => { setFocusedStep1Field(id); onInputFocus?.(id); }}
            onAuthInputBlur={(id) => { setFocusedStep1Field((cur) => (cur === id ? null : cur)); onInputBlur?.(id); }}
          />
          <AuthInput
            label="비밀번호 (8자 이상, 영문+숫자 포함)"
            testID="signup-input-password"
            ref={passwordRef}
            value={password}
            onChangeText={(t) => { setPassword(t); setStep1Errors((e) => ({ ...e, password: '' })); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete="new-password"
            error={step1Errors.password}
            editable={!submitting}
            focusId="signup-password"
            onAuthInputFocus={(id) => { setFocusedStep1Field(id); onInputFocus?.(id); }}
            onAuthInputBlur={(id) => { setFocusedStep1Field((cur) => (cur === id ? null : cur)); onInputBlur?.(id); }}
            rightElement={
              <Pressable
                accessible
                accessibilityRole="button"
              accessibilityLabel={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              onPress={() => setShowPw((p) => !p)}
              style={styles.pwToggle}
              hitSlop={8}
            >
                <Text style={styles.pwToggleIcon}>
                  {showPw ? '숨김' : '표시'}
                </Text>
              </Pressable>
            }
          />
          <AuthInput
            label="비밀번호 확인"
            testID="signup-input-confirm-password"
            ref={confirmPasswordRef}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setStep1Errors((e) => ({ ...e, confirmPassword: '' })); }}
            secureTextEntry={!showConfirmPw}
            autoCapitalize="none"
            autoComplete="new-password"
            error={step1Errors.confirmPassword}
            editable={!submitting}
            focusId="signup-confirm-password"
            onAuthInputFocus={(id) => { setFocusedStep1Field(id); onInputFocus?.(id); }}
            onAuthInputBlur={(id) => { setFocusedStep1Field((cur) => (cur === id ? null : cur)); onInputBlur?.(id); }}
            rightElement={
              <Pressable
                accessible
                accessibilityRole="button"
              accessibilityLabel={showConfirmPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              onPress={() => setShowConfirmPw((p) => !p)}
              style={styles.pwToggle}
              hitSlop={8}
            >
                <Text style={styles.pwToggleIcon}>
                  {showConfirmPw ? '숨김' : '표시'}
                </Text>
              </Pressable>
            }
          />

          {!hideActions && (
            <View style={styles.stepNav}>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="다음 단계"
                onPress={handleStep1Next}
                disabled={submitting}
                style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnPrimary, pressed && styles.ctaBtnPressed]}
              >
                <Text style={styles.stepNavBtnPrimaryText}>다음</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Step 2: Additional Info */}
      {step === 2 && (
        <View accessibilityLabel="2단계: 추가 정보">
          <Text style={styles.stepTitle}>추가 정보</Text>
          <Text style={styles.stepDesc}>공구위시에서 사용할 프로필 정보를 입력해주세요</Text>

          <AuthInput
            label="닉네임"
            testID="signup-input-nickname"
            value={nickname}
            onChangeText={(t) => { setNickname(t); setStep2Errors((e) => ({ ...e, nickname: '' })); }}
            autoCapitalize="none"
            autoComplete="name"
            error={step2Errors.nickname}
            editable={!submitting}
            focusId="signup-nickname"
            onAuthInputFocus={onInputFocus}
            onAuthInputBlur={onInputBlur}
          />
          <AuthInput
            label="휴대폰 번호 (선택)"
            testID="signup-input-phone"
            value={phone}
            onChangeText={(t) => { setPhone(t); setStep2Errors((e) => ({ ...e, phone: '' })); }}
            autoCapitalize="none"
            autoComplete="tel"
            keyboardType="phone-pad"
            inputMode="numeric"
            error={step2Errors.phone}
            editable={!submitting}
            focusId="signup-phone"
            onAuthInputFocus={onInputFocus}
            onAuthInputBlur={onInputBlur}
          />

          {!hideActions && (
            <View style={styles.stepNav}>
              <Pressable
                accessible
                accessibilityRole="button"
                onPress={() => goToPrevStep(1)}
                disabled={submitting}
                style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.stepNavBtnSecondaryText}>이전</Text>
              </Pressable>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="다음 단계"
                onPress={goToNextStep}
                disabled={submitting}
                style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnPrimary, { flex: 2 }, pressed && styles.ctaBtnPressed]}
              >
                <Text style={styles.stepNavBtnPrimaryText}>다음</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Step 3: Agreement */}
      {step === 3 && (
        <View accessibilityLabel="3단계: 약관 동의">
          <Text style={styles.stepTitle}>약관 동의</Text>
          <Text style={styles.stepDesc}>서비스 이용을 위해 약관에 동의해주세요</Text>

          {/* All agree toggle */}
          <View style={styles.agreeGroup}>
            <Pressable
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreements.agreeAll }}
              accessibilityLabel="전체 동의하기"
              onPress={() => toggleAllAgree(!agreements.agreeAll)}
              style={[styles.agreeItem, styles.agreeAll]}
            >
              <View style={[styles.checkbox, agreements.agreeAll && styles.checkboxChecked]}>
                {agreements.agreeAll && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.agreeLabelAll}>
                <Text style={styles.agreeLabelBold}>전체 동의하기</Text>
              </Text>
            </Pressable>

            {AGREEMENTS.map((item) => (
              <Pressable
                key={item.key}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreements[item.key] ?? false }}
                accessibilityLabel={`${item.label}${item.required ? ' (필수)' : ' (선택)'}`}
                onPress={() => toggleAgree(item.key, !agreements[item.key])}
                style={styles.agreeItem}
              >
                <View style={[styles.checkbox, agreements[item.key] && styles.checkboxChecked]}>
                  {agreements[item.key] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.agreeLabel}>{item.label}</Text>
                {item.detailLink && (
                  <Pressable
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} 내용 보기`}
                    onPress={() => {}}
                    hitSlop={8}
                  >
                    <Text style={styles.agreeDetail}>보기</Text>
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>

          {Object.keys(step3Errors).length > 0 && (
            <Text style={[styles.errorText, { marginBottom: 12 }]}>
              {Object.values(step3Errors)[0]}
            </Text>
          )}

          {submitError ? (
            <Text style={[styles.errorText, { marginBottom: 12 }]}>
              {submitError}
            </Text>
          ) : null}

          {!hideActions && (
            <View style={styles.stepNav}>
              <Pressable
                accessible
                accessibilityRole="button"
                onPress={() => goToPrevStep(2)}
                disabled={submitting}
                style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.stepNavBtnSecondaryText}>이전</Text>
              </Pressable>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="가입 완료"
                accessibilityState={{ disabled: submitting }}
                onPress={handleCompleteSignup}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.stepNavBtn,
                  styles.stepNavBtnPrimary,
                  { flex: 2 },
                  pressed && styles.ctaBtnPressed,
                  submitting && styles.ctaBtnDisabled,
                ]}
              >
                <Text style={styles.stepNavBtnPrimaryText}>
                  {submitting ? '가입 처리 중...' : '가입 완료'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Step 4: Email Verification */}
      {step === 4 && (
        <View accessibilityLabel="4단계: 이메일 인증">
          <Text style={styles.stepTitle}>이메일 인증</Text>
          <Text style={styles.stepDesc}>{email}로 받은 인증번호를 입력해주세요</Text>

          <AuthInput
            label="인증번호"
            testID="signup-input-email-code"
            value={verificationCode}
            onChangeText={(t) => {
              setVerificationCode(t.replace(/\D/g, '').slice(0, 6));
              setVerificationError(null);
            }}
            autoCapitalize="none"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            error={verificationError ?? undefined}
            editable={!submitting && secondsLeft > 0}
            focusId="signup-email-code"
            onAuthInputFocus={onInputFocus}
            onAuthInputBlur={onInputBlur}
          />

          <Text style={[styles.stepDesc, { marginBottom: 12 }]}>
            남은 시간 {formatSeconds(secondsLeft)}
          </Text>

          {!hideActions && (
            <View style={styles.stepNav}>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="인증번호 재발송"
                onPress={handleResendEmailCode}
                disabled={submitting}
                style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.stepNavBtnSecondaryText}>재발송</Text>
              </Pressable>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel="인증 완료"
                accessibilityState={{ disabled: submitting || verificationCode.trim().length < 6 || secondsLeft <= 0 }}
                onPress={handleVerifyEmailCode}
                disabled={submitting || verificationCode.trim().length < 6 || secondsLeft <= 0}
                style={({ pressed }) => [
                  styles.stepNavBtn,
                  styles.stepNavBtnPrimary,
                  { flex: 2 },
                  pressed && styles.ctaBtnPressed,
                  (submitting || verificationCode.trim().length < 6 || secondsLeft <= 0) && styles.ctaBtnDisabled,
                ]}
              >
                <Text style={styles.stepNavBtnPrimaryText}>
                  {submitting ? '확인 중...' : '인증 완료'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Action Bar Area (Android only) ────────────────────────────────────────

function ActionBarArea({
  config,
  bottomInset,
  onLayoutHeight,
}: {
  config: ActionBarConfig;
  bottomInset: number;
  onLayoutHeight?: (height: number) => void;
}) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.actionBarArea,
        { paddingBottom: Math.max(bottomInset, 10) },
      ]}
      testID="auth-action-bar"
      onLayout={(event) => {
        onLayoutHeight?.(event.nativeEvent.layout.height);
      }}
    >
      <View style={styles.actionBarInner}>
        {config.secondary && (
          <Pressable
            accessible
            accessibilityRole="button"
            onPress={config.secondary.onPress}
            disabled={config.secondary.disabled}
            style={({ pressed }) => [styles.stepNavBtn, styles.stepNavBtnSecondary, pressed && styles.btnPressed]}
          >
            <Text style={styles.stepNavBtnSecondaryText}>{config.secondary.text}</Text>
          </Pressable>
        )}
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={config.primary.text}
          accessibilityState={{ disabled: config.primary.disabled }}
          onPress={config.primary.onPress}
          disabled={config.primary.disabled}
          style={({ pressed }) => [
            config.variant === 'signup'
              ? [styles.stepNavBtn, styles.stepNavBtnPrimary, config.secondary ? { flex: 2 } : { flex: 1 }]
              : [styles.ctaBtn, config.secondary ? { flex: 2 } : undefined],
            config.primary.disabled && styles.ctaBtnDisabled,
            pressed && !config.primary.disabled && styles.ctaBtnPressed,
          ]}
        >
          <Text style={config.variant === 'signup' ? styles.stepNavBtnPrimaryText : styles.ctaBtnText}>
            {config.primary.text}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Social Login Button ────────────────────────────────────────────────────

function SocialButton({
  label,
  icon,
  backgroundColor,
  textColor,
  borderColor,
  iconStyle,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  iconStyle?: TextStyle;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled ?? false }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.socialBtn,
        {
          backgroundColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor: borderColor ?? 'transparent',
        },
        pressed && !disabled && styles.socialBtnPressed,
        disabled && styles.socialBtnDisabled,
      ]}
    >
      <View style={styles.socialIcon}>
        <Text style={[{ color: textColor, fontSize: 18 }, iconStyle]}>
          {icon}
        </Text>
      </View>
      <Text style={[styles.socialLabel, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Auth Input ─────────────────────────────────────────────────────────────
//
// Identical structure to FormInput (used in SubmitScreen, StoreScreen, etc.)
// which works flawlessly on RN 0.83 / Android Fabric:
//  - label <Text> in normal flow ABOVE the input
//  - <TextInput> directly inside a <View> wrapper, no overlays, no Pressable
//  - no absolute positioning, no floating animation, no placeholder=" "
// See git history — 15+ attempts with absolute/floating/Pressable all failed.

type AuthInputProps = Omit<TextInputProps, 'onFocus' | 'onBlur'> & {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  focusId?: string;
  onAuthInputFocus?: (inputId: string) => void;
  onAuthInputBlur?: (inputId: string) => void;
};

const AuthInput = forwardRef<TextInput, AuthInputProps>(function AuthInput({
  label,
  error,
  rightElement,
  style,
  focusId,
  onAuthInputFocus,
  onAuthInputBlur,
  ...inputProps
}: AuthInputProps, ref) {
  const { colors } = useCommerceTheme();

  return (
    <View style={{ marginBottom: 4 }}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (ref && 'current' in ref) ref.current?.focus();
        }}
      >
        <Text
        style={{
          color: colors.muted,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 6,
        }}
      >
        {label}
        </Text>
      </Pressable>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: error ? colors.error : colors.border,
          borderRadius: commerceRadius.lg,
          height: 52,
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.weak}
          style={[
            {
              flex: 1,
              fontSize: 15,
              color: colors.text,
              paddingVertical: 0,
            },
            rightElement ? { paddingRight: 44 } : undefined,
            style,
          ]}
          accessibilityLabel={label}
          onFocus={() => focusId && onAuthInputFocus?.(focusId)}
          onBlur={() => focusId && onAuthInputBlur?.(focusId)}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: colors.error, marginTop: 4, paddingLeft: 4 }}>
          {error}
        </Text>
      ) : (
        <View style={{ height: 18 }} />
      )}
    </View>
  );
});

// Keep static styles for SocialButton and SocialButton references only
// (socialBtn, socialIcon, socialLabel, etc. have no themable colors)
