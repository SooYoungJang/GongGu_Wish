/**
 * AuthScreen — Coral Wave Redesign v2 (Refined)
 *
 * Refined Coral Wave design — balances brand identity with app consistency:
 *  - Warm beige (#f5f0eb) background kept as brand signature
 *  - Underline-style tabs (was segment control) for cleaner look
 *  - Refined header icon with premium shadow
 *  - Subtle wave decoration (reduced height, softer opacity)
 *  - Rounded corners unified to 14px throughout
 *
 * Single-page Login / Signup screen with:
 *  - Tab switching (Login ↔ Signup)
 *  - Social login buttons (Kakao / Apple / Google)
 *  - Floating label inputs with Zod validation
 *  - Password visibility toggle & "Forgot password" link
 *  - 3-step Progressive Disclosure for signup
 *  - Agreement checkboxes (all-agree + required/optional)
 *  - Responsive (mobile-first) + WCAG AA accessibility
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GoBackHeader } from '../components/GoBackHeader';
import type { ColorPalette } from '../context/ThemeContext';
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
import { mapAuthErrorMessage, SOCIAL_PROVIDERS } from '../utils/authHelpers';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthTab = 'login' | 'signup';
type SignupStep = 1 | 2 | 3;

export type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

// ─── Action Bar Config ─────────────────────────────────────────────────────

type ActionBarItem = {
  text: string;
  onPress: () => void;
  disabled: boolean;
};

type ActionBarConfig = {
  primary: ActionBarItem;
  secondary?: ActionBarItem;
};

// ─── Coral Wave Primary Color ───────────────────────────────────────────────

const CORAL = '#ff385c';
const CORAL_FOCUS = 'rgba(255, 56, 92, 0.28)';
const WARM_BG = '#f5f0eb';

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AuthScreen(_props: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  const [actionBar, setActionBar] = useState<ActionBarConfig | null>(null);
  const [focusedInputCount, setFocusedInputCount] = useState(0);

  // Reset action bar on tab switch; child panels re-report via onActionBarChange
  useEffect(() => {
    setActionBar(null);
  }, [activeTab]);

  const isKeyboardVisible = focusedInputCount > 0;
  const onInputFocus = useCallback(() => setFocusedInputCount(c => c + 1), []);
  const onInputBlur = useCallback(() => setFocusedInputCount(c => Math.max(0, c - 1)), []);

  return (
    <View
      style={[styles.container, { backgroundColor: WARM_BG }]}
      accessibilityLabel="공구위시 로그인 화면"
    >
      <GoBackHeader />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {Platform.OS === 'ios' ? (
          /* iOS: existing KeyboardAvoidingView layout — buttons inside ScrollView */
          <KeyboardAvoidingView
            style={styles.flex}
            behavior="padding"
            keyboardVerticalOffset={insets.top}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              <AuthHeader />
              <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />
              <AuthContentArea activeTab={activeTab} />
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          /* Android: ScrollView (no buttons) + fixed bottom action bar */
          <View style={styles.flex}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              <AuthHeader />
              <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />
              <AuthContentArea activeTab={activeTab} onActionBarChange={setActionBar} hideActions={isKeyboardVisible} onInputFocus={onInputFocus} onInputBlur={onInputBlur} />
            </ScrollView>
            {actionBar && isKeyboardVisible && (
              <ActionBarArea config={actionBar} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Header: App Icon + Name + Welcome ──────────────────────────────────────

function AuthHeader() {
  return (
    <View style={styles.header} accessible accessibilityLabel="공구위시">
      <View style={styles.headerIcon} accessibilityElementsHidden>
        <Text style={styles.headerIconText}>♥</Text>
      </View>
      <Text style={styles.appName}>
        공구<Text style={styles.appNameAccent}>위시</Text>
      </Text>
      <Text style={styles.welcomeText}>함께 사면 더 즐거운 공동구매</Text>
    </View>
  );
}

// ─── Tab Bar: Login / Signup ────────────────────────────────────────────────

function AuthTabs({ activeTab, onTabChange }: { activeTab: AuthTab; onTabChange: (tab: AuthTab) => void }) {
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
  onInputFocus?: () => void;
  onInputBlur?: () => void;
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
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signInWithOAuth } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<string | null>(null);

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

  const handleSocialLogin = useCallback(
    async (provider: 'kakao' | 'apple' | 'google') => {
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
    onActionBarChange?.({
      primary: {
        text: submitting ? '로그인 중...' : '로그인',
        onPress: handleLogin,
        disabled: submitting,
      },
    });
  }, [submitting, handleLogin, onActionBarChange]);

  return (
    <View accessibilityLabel="로그인">
      {/* Social Login — refined: no title */}
      <View style={styles.socialSection}>
        {SOCIAL_PROVIDERS.map((sp) => (
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
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          error={errors.email}
          editable={!submitting}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
        />
        <AuthInput
          label="비밀번호"
          testID="fl-input-password"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          error={errors.password}
          editable={!submitting}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          rightElement={
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((p) => !p)}
              style={s.pwToggle}
              hitSlop={8}
            >
              <Text style={s.pwToggleIcon}>
                {showPassword ? '🙈' : '👁'}
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
          <Text style={[s.errorText, { marginBottom: 12, marginTop: 4 }]}>
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
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { signUp } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<SignupStep>(1);

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
      const authError = await signUp(email, password);
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
  }, [email, password, agreements, signUp, navigation]);

  // ── Report action bar config ─────────────────────────────────────────
  useEffect(() => {
    if (step === 1) {
      onActionBarChange?.({
        primary: { text: '다음', onPress: goToNextStep, disabled: submitting },
      });
    } else if (step === 2) {
      onActionBarChange?.({
        primary: { text: '다음', onPress: goToNextStep, disabled: submitting },
        secondary: { text: '이전', onPress: () => goToPrevStep(1), disabled: submitting },
      });
    } else if (step === 3) {
      onActionBarChange?.({
        primary: {
          text: submitting ? '가입 처리 중...' : '가입 완료',
          onPress: handleCompleteSignup,
          disabled: submitting,
        },
        secondary: { text: '이전', onPress: () => goToPrevStep(2), disabled: submitting },
      });
    }
  }, [step, submitting, goToNextStep, goToPrevStep, handleCompleteSignup, onActionBarChange]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View accessibilityLabel="회원가입">
      {/* Step Progress */}
      <View
        style={styles.stepProgress}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ now: step, min: 1, max: 3 }}
        accessibilityLabel="회원가입 진행 단계"
      >
        {([1, 2, 3] as const).map((s) => (
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
        <View accessible accessibilityLabel="1단계: 기본 정보">
          <Text style={styles.stepTitle}>기본 정보</Text>
          <Text style={styles.stepDesc}>공구위시 가입을 위한 기본 정보를 입력해주세요</Text>

          <AuthInput
            label="이메일"
            testID="signup-input-email"
            value={email}
            onChangeText={(t) => { setEmail(t); setStep1Errors((e) => ({ ...e, email: '' })); }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            error={step1Errors.email}
            editable={!submitting}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
          />
          <AuthInput
            label="비밀번호 (8자 이상, 영문+숫자 포함)"
            testID="signup-input-password"
            value={password}
            onChangeText={(t) => { setPassword(t); setStep1Errors((e) => ({ ...e, password: '' })); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete="new-password"
            error={step1Errors.password}
            editable={!submitting}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            rightElement={
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                onPress={() => setShowPw((p) => !p)}
                style={s.pwToggle}
                hitSlop={8}
              >
                <Text style={s.pwToggleIcon}>
                  {showPw ? '🙈' : '👁'}
                </Text>
              </Pressable>
            }
          />
          <AuthInput
            label="비밀번호 확인"
            testID="signup-input-confirm-password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setStep1Errors((e) => ({ ...e, confirmPassword: '' })); }}
            secureTextEntry={!showConfirmPw}
            autoCapitalize="none"
            autoComplete="new-password"
            error={step1Errors.confirmPassword}
            editable={!submitting}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            rightElement={
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={showConfirmPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                onPress={() => setShowConfirmPw((p) => !p)}
                style={s.pwToggle}
                hitSlop={8}
              >
                <Text style={s.pwToggleIcon}>
                  {showConfirmPw ? '🙈' : '👁'}
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
              onPress={goToNextStep}
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
        <View accessible accessibilityLabel="2단계: 추가 정보">
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
            onFocus={onInputFocus}
            onBlur={onInputBlur}
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
            onFocus={onInputFocus}
            onBlur={onInputBlur}
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
        <View accessible accessibilityLabel="3단계: 약관 동의">
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
            <Text style={[s.errorText, { marginBottom: 12 }]}>
              {Object.values(step3Errors)[0]}
            </Text>
          )}

          {submitError ? (
            <Text style={[s.errorText, { marginBottom: 12 }]}>
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
    </View>
  );
}

// ─── Action Bar Area (Android only) ────────────────────────────────────────

function ActionBarArea({ config }: { config: ActionBarConfig }) {
  return (
    <View style={styles.actionBarArea}>
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
            styles.ctaBtn,
            config.secondary ? { flex: 2 } : { flex: 1 },
            config.primary.disabled && styles.ctaBtnDisabled,
            pressed && !config.primary.disabled && styles.ctaBtnPressed,
          ]}
        >
          <Text style={styles.ctaBtnText}>{config.primary.text}</Text>
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

type AuthInputProps = TextInputProps & {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
};

function AuthInput({
  label,
  error,
  rightElement,
  style,
  ...inputProps
}: AuthInputProps) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 4 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderWidth: 1.5,
          borderColor: error ? '#d93f4c' : colors.border,
          borderRadius: 14,
          height: 52,
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[
            {
              flex: 1,
              fontSize: 15,
              color: colors.textPrimary,
              paddingVertical: 0,
            },
            rightElement ? { paddingRight: 44 } : undefined,
            style,
          ]}
          accessibilityLabel={label}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: '#d93f4c', marginTop: 4, paddingLeft: 4 }}>
          {error}
        </Text>
      ) : (
        <View style={{ height: 18 }} />
      )}
    </View>
  );
}

// ─── Style helpers that depend on theme ──────────────────────────────────────

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    pwToggle: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      padding: 4,
    },
    pwToggleIcon: {
      fontSize: 18,
      color: colors.textTertiary,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
    },
  });

// ─── Static Styles (no theme dependency) ─────────────────────────────────────

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    flexGrow: 1,
    paddingBottom: 120,
  },
  actionBarArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WARM_BG,
    paddingHorizontal: 24,
    paddingTop: 10,
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
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: CORAL,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  headerIconText: {
    fontSize: 28,
    color: '#ffffff',
  },
  appName: {
    fontWeight: '800',
    fontSize: 22,
    color: '#1c1b1a',
    letterSpacing: -0.5,
  },
  appNameAccent: {
    color: CORAL,
    fontWeight: '800',
    fontSize: 22,
  },
  welcomeText: {
    fontWeight: '400',
    fontSize: 14,
    color: '#6b6560',
    marginTop: 6,
    letterSpacing: -0.2,
  },

  // Tab bar — refined underline style (coral wave v2)
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#e8e3de',
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
    borderBottomColor: CORAL,
  },
  tabBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8c8681',
  },
  tabBtnTextActive: {
    color: CORAL,
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
    backgroundColor: '#e8e3de',
  },
  dividerText: {
    fontSize: 12,
    color: '#8c8681',
    fontWeight: '500',
  },

  // CTA Button — refined coral wave
  ctaBtn: {
    width: '100%',
    height: 54,
    backgroundColor: CORAL,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnText: {
    color: '#ffffff',
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
    color: '#6b6560',
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
    backgroundColor: '#d6d0ca',
  },
  stepDotActive: {
    backgroundColor: CORAL,
    width: 28,
    borderRadius: 4,
  },
  stepDotDone: {
    backgroundColor: '#2d9c5e',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1b1a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 13,
    color: '#6b6560',
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNavBtnPrimary: {
    backgroundColor: CORAL,
    borderWidth: 0,
  },
  stepNavBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepNavBtnSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d6d0ca',
  },
  stepNavBtnSecondaryText: {
    color: '#6b6560',
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
    borderBottomColor: '#e8e3de',
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
    borderColor: '#d6d0ca',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: CORAL,
    borderColor: CORAL,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  agreeLabelAll: {
    fontSize: 14,
    color: '#1c1b1a',
    flex: 1,
  },
  agreeLabelBold: {
    fontWeight: '700',
  },
  agreeLabel: {
    fontSize: 14,
    color: '#1c1b1a',
    flex: 1,
    letterSpacing: -0.2,
  },
  agreeDetail: {
    fontSize: 12,
    color: '#8c8681',
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
    borderRadius: 14,
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
});
