import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubmissionGuard } from '@gonggu/shared/hooks';

import { postPublicJson, ApiError } from '../api';
import { AppButton } from '../components/AppButton';
import { FormInput } from '../components/FormInput';
import { InstagramPreview } from '../components/InstagramPreview';
import { SText } from '../components/ui/SText';
import { UrlInputStatus } from '../components/UrlInputStatus';
import { useHikerApi } from '../hooks/useHikerApi';
import { borderRadius, spacing } from '../design/tokens';
import type { SubmitScreenProps } from '../types';
import { isValidOptionalUrl, normalizeOptional } from '../utils';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackKind = 'info' | 'success' | 'error';

interface Feedback {
  message: string;
  kind: FeedbackKind;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmitScreen({ navigation }: SubmitScreenProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Form state
  const [instagramUrl, setInstagramUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [endDate, setEndDate] = useState('');

  // HikerAPI — auto-fetches Instagram post info
  const { status: hikerStatus, data: hikerData, error: hikerError, retry } = useHikerApi(instagramUrl);

  // UX state
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guard, reset } = useSubmissionGuard();
  const scrollRef = useRef<ScrollView>(null);

  // ─── Validation ─────────────────────────────────────────────────────────

  function validate(): string | null {
    if (instagramUrl.trim().length < 5) {
      return '인스타그램 게시물 URL을 입력해주세요.';
    }
    if (!isValidOptionalUrl(instagramUrl)) {
      return '인스타그램 URL 형식이 올바르지 않습니다.';
    }
    if (productName.trim().length < 2) {
      return '제품명은 2자 이상 필수입니다.';
    }
    if (purchaseUrl.trim() && !isValidOptionalUrl(purchaseUrl)) {
      return '구매 링크는 http(s) URL 형식이어야 합니다.';
    }
    if (endDate.trim()) {
      const date = new Date(endDate.trim());
      if (Number.isNaN(date.getTime())) {
        return '마감일은 YYYY-MM-DD 형식으로 입력해주세요.';
      }
    }
    return null;
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const error = validate();
    if (error) {
      setFeedback({ message: error, kind: 'error' });
      return;
    }
    if (!guard()) return;

    setIsSubmitting(true);
    setFieldErrors({});
    setFeedback({ message: '제보를 접수하는 중입니다...', kind: 'info' });

    try {
      await postPublicJson('/submissions', {
        productName: productName.trim(),
        brandName: normalizeOptional(brandName),
        endDate: normalizeOptional(endDate),
        purchaseUrl: normalizeOptional(purchaseUrl),
        instagramUrl: instagramUrl.trim(),
        imageUrls: hikerData?.imageUrl ? [hikerData.imageUrl] : [],
        summary: hikerData?.caption ?? undefined,
        isAnonymous: true,
      });
      setFeedback({ message: '제보가 접수되었습니다. 운영자 승인 후 캘린더에 반영됩니다.', kind: 'success' });
      // Brief pause so the user can read the feedback, then navigate
      setTimeout(() => navigation.navigate('Home'), 900);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimit) {
          setFeedback({ message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', kind: 'error' });
        } else if (err.isValidationError && err.errors) {
          // Show first validation error as feedback
          setFeedback({ message: err.errors[0].message, kind: 'error' });
          // Map field errors for inline display
          const fieldMap: Record<string, string> = {};
          for (const ve of err.errors) {
            fieldMap[ve.field] = ve.message;
          }
          setFieldErrors(fieldMap);
        } else if (err.isNetworkError) {
          setFeedback({ message: '네트워크 연결을 확인해주세요.', kind: 'error' });
        } else {
          setFeedback({ message: err.message, kind: 'error' });
        }
      } else {
        setFeedback({
          message: err instanceof Error ? err.message : '제보 접수에 실패했습니다. 다시 시도해주세요.',
          kind: 'error',
        });
      }
    } finally {
      setIsSubmitting(false);
      reset();
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={s.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────────── */}
          <SText variant="eyebrow" style={s.eyebrow}>
            공구 제보하기
          </SText>
          <SText variant="title" style={s.title}>
            발견한 공구를 알려주세요
          </SText>
          <SText variant="subtitle" style={s.subtitle}>
            인스타그램 게시물 URL만 입력하면 이미지와 정보를 자동으로 불러옵니다
          </SText>

          {/* ── Feedback banner ────────────────────────────── */}
          {feedback ? (
            <View style={[s.feedbackBanner, s[`feedback_${feedback.kind}`]]}>
              <SText variant="caption" style={[s.feedbackText, s[`feedbackText_${feedback.kind}`]]}>
                {feedback.message}
              </SText>
            </View>
          ) : null}

          {/* ── Instagram URL — Hero input ─────────────────── */}
          <View style={s.urlSection}>
            <View style={s.urlLabelRow}>
              <SText variant="label" style={s.urlLabel}>인스타그램 게시물 URL</SText>
              <SText variant="caption" style={s.requiredBadge}>필수</SText>
            </View>
            <View style={[s.urlInputWrapper, hikerStatus === 'loading' && s.urlInputLoading]}>
              <View style={s.urlIcon}>
                <SText variant="caption" style={s.urlIconText}>📸</SText>
              </View>
              <TextInput
                value={instagramUrl}
                onChangeText={(v) => {
                  setInstagramUrl(v);
                  setFieldErrors({});
                }}
                placeholder="https://www.instagram.com/p/..."
                placeholderTextColor={colors.textTertiary}
                style={s.urlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
              />
              <UrlInputStatus status={hikerStatus} />
            </View>
          </View>

          {/* ── Instagram Preview ──────────────────────────── */}
          <InstagramPreview
            status={hikerStatus}
            data={hikerData}
            error={hikerError}
            onRetry={retry}
          />

          {/* ── Remaining fields (compact) ─────────────────── */}
          <View style={s.fieldsSection}>
            <SText variant="eyebrow" style={s.sectionLabel}>
              추가 정보
            </SText>

            <FormInput
              label="제품명 *"
              value={productName}
              onChangeText={setProductName}
              placeholder="예: 비건 선크림"
              error={fieldErrors.productName}
            />
            <FormInput
              label="브랜드"
              value={brandName}
              onChangeText={setBrandName}
              placeholder="예: 샘플뷰티"
            />
            <FormInput
              label="구매 링크"
              value={purchaseUrl}
              onChangeText={setPurchaseUrl}
              placeholder="https://..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={fieldErrors.purchaseUrl}
            />
            <FormInput
              label="마감일"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              error={fieldErrors.endDate}
            />
          </View>

          {/* ── Action area ────────────────────────────────── */}
          <View style={s.actionArea}>
            <AppButton
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={s.submitButton}
              variant="primary"
            >
              {isSubmitting ? '제출 중...' : '공구 제보하기'}
            </AppButton>
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primary} style={s.spinner} />
            ) : null}

            <Pressable
              onPress={() => navigation.navigate('Home')}
              style={s.cancelButton}
              accessibilityRole="button"
            >
              <SText variant="body" style={s.cancelText}>
                취소하고 돌아가기
              </SText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing['4xl'],
    },

    // Header
    eyebrow: {
      marginBottom: spacing.xs,
      color: colors.primary,
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing['2xl'],
    },

    // Feedback banner
    feedbackBanner: {
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    feedback_info: {
      backgroundColor: colors.primaryBg,
    },
    feedback_success: {
      backgroundColor: colors.successBg,
    },
    feedback_error: {
      backgroundColor: colors.errorBg,
    },
    feedbackText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    feedbackText_info: {
      color: colors.primary,
    },
    feedbackText_success: {
      color: colors.success,
    },
    feedbackText_error: {
      color: colors.error,
    },

    // Instagram URL — hero input
    urlSection: {
      marginBottom: spacing.sm,
    },
    urlLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    urlLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      marginRight: spacing.sm,
    },
    requiredBadge: {
      color: colors.primary,
      backgroundColor: colors.primaryBg,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      fontWeight: '600',
      fontSize: 11,
    },
    urlInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primaryBg,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
    },
    urlInputLoading: {
      borderColor: colors.primary,
    },
    urlIcon: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    urlIconText: {
      fontSize: 14,
    },
    urlInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 12,
    },

    // Fields section
    fieldsSection: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      color: colors.textTertiary,
      letterSpacing: 0.8,
      marginBottom: spacing.md,
      fontSize: 11,
    },

    // Action area
    actionArea: {
      gap: spacing.md,
    },
    submitButton: {
      paddingVertical: 14,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    cancelText: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    spinner: {
      marginTop: spacing.xs,
    },
  });
}
