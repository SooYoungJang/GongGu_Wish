/**
 * Auth Helper Utilities
 *
 * Shared helper functions extracted from AuthScreen.tsx for SRP compliance.
 */
import { Platform } from 'react-native';
import type { Provider } from '@supabase/supabase-js';

// ─── Error Message Mapping ───────────────────────────────────────────────────

export function mapAuthErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as { message?: string; code?: string; status?: number };
    const msg = err.message ?? err.code ?? '';

    if (msg.includes('Invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (msg.includes('Email not confirmed')) {
      return '이메일 인증이 완료되지 않았습니다. 인증번호를 확인해주세요.';
    }
    if (msg.includes('User already registered')) {
      return '이미 가입된 이메일입니다. 로그인해주세요.';
    }
    if (msg.includes('Token has expired') || msg.includes('otp_expired')) {
      return '인증번호가 만료되었습니다. 다시 발송해주세요.';
    }
    if (msg.includes('Token is invalid') || msg.includes('invalid token')) {
      return '인증번호가 올바르지 않습니다.';
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

export type SocialAuthProvider = Extract<Provider, 'kakao' | 'apple'> | 'custom:naver';

export interface SocialProviderConfig {
  provider: SocialAuthProvider;
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  iconStyle?: Record<string, string | number>;
  accessibilityLabel: string;
  platforms?: Array<'ios' | 'android'>;
}

export const SOCIAL_PROVIDERS: SocialProviderConfig[] = [
  {
    provider: 'kakao',
    label: '카카오로 계속하기',
    icon: '💬',
    backgroundColor: '#FEE500',
    textColor: '#1a1a1a',
    accessibilityLabel: '카카오로 계속하기',
  },
  {
    provider: 'custom:naver',
    label: '네이버로 계속하기',
    icon: 'N',
    backgroundColor: '#03C75A',
    textColor: '#ffffff',
    iconStyle: { fontWeight: '800' as const, fontSize: 17 },
    accessibilityLabel: '네이버로 계속하기',
  },
  {
    provider: 'apple',
    label: 'Apple로 계속하기',
    icon: '',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    iconStyle: { fontSize: 22 },
    accessibilityLabel: 'Apple로 계속하기',
    platforms: ['ios'],
  },
];

export function getSocialProvidersForPlatform(
  os: string = Platform.OS,
): SocialProviderConfig[] {
  return SOCIAL_PROVIDERS.filter((provider) => {
    if (!provider.platforms) return true;
    return provider.platforms.includes(os as 'ios' | 'android');
  });
}
