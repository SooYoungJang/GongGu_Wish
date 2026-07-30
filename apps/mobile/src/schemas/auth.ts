/**
 * Auth-related Zod validation schemas.
 *
 * Used by AuthScreen for Login and 3-step Signup forms.
 */
import { z } from 'zod';

// ─── Password Rules ────────────────────────────────────────────────────────

export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
} as const;

// ─── Login Schema ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요.'),
});

export type LoginForm = z.infer<typeof loginSchema>;

// ─── Signup Step 1: Basic Info (Email + Password) ──────────────────────────

export const signupStep1Schema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(PASSWORD_RULES.minLength, `비밀번호는 ${PASSWORD_RULES.minLength}자 이상이어야 합니다.`)
    .max(PASSWORD_RULES.maxLength, `비밀번호는 ${PASSWORD_RULES.maxLength}자 이하여야 합니다.`)
    .regex(
      /^(?=.*[a-zA-Z])(?=.*\d)/,
      '비밀번호는 영문과 숫자를 포함해야 합니다.',
    ),
  confirmPassword: z
    .string()
    .min(1, '비밀번호를 다시 입력해주세요.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

export type SignupStep1Form = z.infer<typeof signupStep1Schema>;

// ─── Signup Step 2: Profile (Nickname + optional Phone) ────────────────────

export const signupStep2Schema = z.object({
  nickname: z
    .string()
    .min(1, '닉네임을 입력해주세요.')
    .max(50, '닉네임은 50자 이하여야 합니다.')
    .trim(),
  phone: z
    .string()
    .regex(/^\d{10,11}$/, '올바른 휴대폰 번호 형식이 아닙니다.')
    .or(z.literal(''))
    .optional()
    .default(''),
});

export type SignupStep2Form = z.infer<typeof signupStep2Schema>;
