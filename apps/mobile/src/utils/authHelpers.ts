/**
 * Auth Helper Utilities
 *
 * Shared helper functions extracted from AuthScreen.tsx for SRP compliance.
 */

// ─── Error Message Mapping ───────────────────────────────────────────────────

export function mapAuthErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as { message?: string; code?: string; status?: number };
    const msg = err.message ?? err.code ?? '';

    if (msg.includes('Invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (msg.includes('Email not confirmed')) {
      return '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.';
    }
    if (msg.includes('User already registered')) {
      return '이미 가입된 이메일입니다. 로그인해주세요.';
    }
    if (msg.includes('Password should be at least 6 characters')) {
      return '비밀번호는 6자 이상이어야 합니다.';
    }
    if (msg.includes('rate limit')) {
      return '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
    }
  }
  return '오류가 발생했습니다. 다시 시도해주세요.';
}

// ─── Social Login Provider Config ────────────────────────────────────────────

export interface SocialProviderConfig {
  provider: 'kakao' | 'apple' | 'google';
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  iconStyle?: Record<string, string | number>;
  accessibilityLabel: string;
}

export const SOCIAL_PROVIDERS: SocialProviderConfig[] = [
  {
    provider: 'kakao',
    label: '카카오로 로그인',
    icon: '💬',
    backgroundColor: '#FEE500',
    textColor: '#1a1a1a',
    accessibilityLabel: '카카오로 로그인',
  },
  {
    provider: 'apple',
    label: 'Apple로 로그인',
    icon: '',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    iconStyle: { fontSize: 22 },
    accessibilityLabel: 'Apple로 로그인',
  },
  {
    provider: 'google',
    label: 'Google로 로그인',
    icon: 'G',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    borderColor: '#d6d0ca',
    iconStyle: { fontWeight: '700' as const, fontSize: 16, color: '#4285F4' },
    accessibilityLabel: 'Google로 로그인',
  },
];
