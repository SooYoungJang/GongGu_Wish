import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubmissionGuard } from '@gonggu/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';

import { postPublicJson, ApiError } from '../api';
import { AppButton } from '../components/AppButton';
import { FormInput } from '../components/FormInput';
import { ScreenHeader } from '../components/ScreenHeader';
import { InstagramPreview } from '../components/InstagramPreview';
import { SText } from '../components/ui/SText';
import { UrlInputStatus } from '../components/UrlInputStatus';
import { useHikerApi } from '../hooks/useHikerApi';
import { borderRadius, spacing } from '../design/tokens';
import type { SubmitScreenProps } from '../types';
import { isValidOptionalUrl, normalizeOptional } from '../utils';
import { parseSubmissionCaption } from '../utils/captionParser';
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
  const queryClient = useQueryClient();

  // Form state
  const [instagramUrl, setInstagramUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [discountInfo, setDiscountInfo] = useState('');
  const [summary, setSummary] = useState('');

  // HikerAPI — auto-fetches Instagram post info
  const { status: hikerStatus, data: hikerData, error: hikerError, retry } = useHikerApi(instagramUrl);

  // UX state
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const { guard, reset } = useSubmissionGuard();
  const scrollRef = useRef<ScrollView>(null);
  const parsedCaptionKeyRef = useRef('');

  useEffect(() => {
    if (hikerStatus !== 'success' || !hikerData?.caption) return;

    const key = `${instagramUrl.trim()}::${hikerData.caption}`;
    if (parsedCaptionKeyRef.current === key) return;
    parsedCaptionKeyRef.current = key;

    const parsed = parseSubmissionCaption(hikerData.caption, {
      referenceDate: hikerData.postedAt ? new Date(hikerData.postedAt) : new Date(),
      fallbackBrandName: hikerData.authorUsername ?? hikerData.authorName,
    });

    const shouldFillProductName = !productName.trim() && parsed.productName;
    const shouldFillBrandName = !brandName.trim() && parsed.brandName;
    const shouldFillStartDate = !startDate.trim() && parsed.startDate;
    const shouldFillEndDate = !endDate.trim() && parsed.endDate;
    const shouldFillPurchaseUrl = !purchaseUrl.trim() && parsed.purchaseUrl;
    const shouldFillDiscountInfo = !discountInfo.trim() && parsed.discountInfo;
    const shouldFillSummary = !summary.trim() && hikerData.caption;

    if (shouldFillProductName && parsed.productName) setProductName(parsed.productName);
    if (shouldFillBrandName && parsed.brandName) setBrandName(parsed.brandName);
    if (shouldFillStartDate && parsed.startDate) setStartDate(parsed.startDate);
    if (shouldFillEndDate && parsed.endDate) setEndDate(parsed.endDate);
    if (shouldFillPurchaseUrl && parsed.purchaseUrl) setPurchaseUrl(parsed.purchaseUrl);
    if (shouldFillDiscountInfo && parsed.discountInfo) setDiscountInfo(parsed.discountInfo);
    if (shouldFillSummary) setSummary(hikerData.caption!.slice(0, 500));

    if (
      shouldFillProductName ||
      shouldFillBrandName ||
      shouldFillStartDate ||
      shouldFillEndDate ||
      shouldFillPurchaseUrl ||
      shouldFillDiscountInfo ||
      shouldFillSummary
    ) {
      setFeedback({ message: '캡션에서 공구 정보를 자동으로 채웠어요. 필요한 부분만 수정해 주세요.', kind: 'info' });
    }
  }, [
    brandName,
    discountInfo,
    endDate,
    hikerData?.authorName,
    hikerData?.authorUsername,
    hikerData?.caption,
    hikerData?.postedAt,
    hikerStatus,
    instagramUrl,
    productName,
    purchaseUrl,
    summary,
    startDate,
  ]);

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
    if (startDate.trim()) {
      const date = new Date(startDate.trim());
      if (Number.isNaN(date.getTime())) {
        return '시작일은 YYYY-MM-DD 형식으로 입력해주세요.';
      }
    }
    if (endDate.trim()) {
      const date = new Date(endDate.trim());
      if (Number.isNaN(date.getTime())) {
        return '마감일은 YYYY-MM-DD 형식으로 입력해주세요.';
      }
    }
    if (startDate.trim() && endDate.trim() && new Date(startDate.trim()) > new Date(endDate.trim())) {
      return '시작일은 마감일보다 늦을 수 없습니다.';
    }
    if (summary.trim().length > 500) {
      return '요약은 500자 이하로 입력해주세요.';
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
        startDate: normalizeOptional(startDate),
        endDate: normalizeOptional(endDate),
        purchaseUrl: normalizeOptional(purchaseUrl),
        discountInfo: normalizeOptional(discountInfo),
        instagramUrl: instagramUrl.trim(),
        imageUrls: hikerData?.imageUrl ? [hikerData.imageUrl] : [],
        summary: summary.trim() || undefined,
        isAnonymous: true,
      });
      void queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      void queryClient.invalidateQueries({ queryKey: ['feeds'] });
      setFeedback({ message: '제보한 공구가 홈에 바로 등록되었습니다.', kind: 'success' });
      setIsSuccessModalVisible(true);
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
      <Modal
        animationType="fade"
        transparent
        visible={isSuccessModalVisible}
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={s.successBackdrop}>
          <View style={s.successDialog}>
            <View style={s.successIcon}>
              <SText variant="body" style={s.successIconText}>✓</SText>
            </View>
            <SText variant="title" style={s.successTitle}>
              제보 완료
            </SText>
            <SText variant="body" style={s.successBody}>
              제보한 공구가 바로 등록됐어요. 홈에서 최신 공구 목록을 다시 불러옵니다.
            </SText>
            <AppButton
              onPress={() => {
                setIsSuccessModalVisible(false);
                navigation.navigate('Home');
              }}
              style={s.successButton}
              variant="primary"
            >
              홈에서 확인하기
            </AppButton>
          </View>
        </View>
      </Modal>
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
          <ScreenHeader
            eyebrow="공구 제보하기"
            title="발견한 공구를 알려주세요"
            subtitle="인스타그램 게시물 URL만 입력하면 이미지와 정보를 자동으로 불러옵니다"
          />

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
              label="시작일"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              error={fieldErrors.startDate}
            />
            <FormInput
              label="마감일"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              error={fieldErrors.endDate}
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
              label="할인 정보"
              value={discountInfo}
              onChangeText={setDiscountInfo}
              placeholder="예: 정가 229,000원 → 29% 163,560원"
              error={fieldErrors.discountInfo}
            />
            <FormInput
              label="요약"
              value={summary}
              onChangeText={setSummary}
              placeholder="공구 한 줄 요약 (최대 500자)"
              multiline
              error={fieldErrors.summary}
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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing['4xl'],
    },

    // Success modal
    successBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    successDialog: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing['2xl'],
      width: '100%',
      maxWidth: 340,
    },
    successIcon: {
      alignItems: 'center',
      backgroundColor: colors.successBg,
      borderRadius: borderRadius.full,
      height: 52,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 52,
    },
    successIconText: {
      color: colors.success,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 32,
    },
    successTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    successBody: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
    successButton: {
      alignSelf: 'stretch',
      paddingVertical: 13,
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
    urlClearButton: {
      alignItems: 'center',
      height: 24,
      justifyContent: 'center',
      marginLeft: spacing.sm,
      width: 24,
    },
    urlClearIcon: {
      color: colors.textTertiary,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
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
