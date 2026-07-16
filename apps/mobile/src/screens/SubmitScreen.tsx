import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubmissionGuard } from '@gonggu/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';

import { postPublicJson, ApiError } from '../api';
import { AppButton } from '../components/AppButton';
import { FormInput } from '../components/FormInput';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { InstagramPreview } from '../components/InstagramPreview';
import { SText } from '../components/ui/SText';
import { UrlInputStatus } from '../components/UrlInputStatus';
import { CATEGORIES } from '../components/home/CategoryRow';
import { useHikerApi } from '../hooks/useHikerApi';
import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import type { GroupBuyCategory, SubmitScreenProps } from '../types';
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

type DateFieldKey = 'startDate' | 'endDate';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getCalendarDays(monthDate: Date): Array<Date | null> {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const days: Array<Date | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getMonthTitle(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmitScreen({ navigation }: SubmitScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  // Form state
  const [instagramUrl, setInstagramUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState<GroupBuyCategory | ''>('');
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
  const [isUrlFocused, setIsUrlFocused] = useState(false);
  const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [datePickerField, setDatePickerField] = useState<DateFieldKey | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const { guard, reset } = useSubmissionGuard();
  const urlInputRef = useRef<TextInput>(null);
  const parsedCaptionKeyRef = useRef('');

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setFocusedInputId(null);
      setIsUrlFocused(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = useCallback((inputId: string) => {
    setFocusedInputId(inputId);
  }, []);

  const handleInputBlur = useCallback((inputId: string) => {
    setFocusedInputId((current) => (current === inputId ? null : current));
  }, []);

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
    const shouldFillStartDate = !startDate.trim() && parsed.startDate;
    const shouldFillEndDate = !endDate.trim() && parsed.endDate;
    const shouldFillPurchaseUrl = !purchaseUrl.trim() && parsed.purchaseUrl;
    const shouldFillDiscountInfo = !discountInfo.trim() && parsed.discountInfo;

    if (shouldFillProductName && parsed.productName) setProductName(parsed.productName);
    if (shouldFillStartDate && parsed.startDate) setStartDate(parsed.startDate);
    if (shouldFillEndDate && parsed.endDate) setEndDate(parsed.endDate);
    if (shouldFillPurchaseUrl && parsed.purchaseUrl) setPurchaseUrl(parsed.purchaseUrl);
    if (shouldFillDiscountInfo && parsed.discountInfo) setDiscountInfo(parsed.discountInfo);
    if (!summary.trim() && hikerData.caption) setSummary(hikerData.caption.slice(0, 500));

    if (
      shouldFillProductName ||
      shouldFillStartDate ||
      shouldFillEndDate ||
      shouldFillPurchaseUrl ||
      shouldFillDiscountInfo ||
      !summary.trim()
    ) {
      setFeedback({ message: '캡션에서 공구 정보를 자동으로 채웠어요. 필요한 부분만 수정해 주세요.', kind: 'info' });
    }
  }, [
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
    if (!category) {
      return '카테고리를 선택해주세요.';
    }
    if (purchaseUrl.trim() && !isValidOptionalUrl(purchaseUrl)) {
      return '구매 링크는 http(s) URL 형식이어야 합니다.';
    }
    if (startDate.trim()) {
      if (!parseDateValue(startDate.trim())) {
        return '시작일은 YYYY-MM-DD 형식으로 입력해주세요.';
      }
    }
    if (endDate.trim()) {
      if (!parseDateValue(endDate.trim())) {
        return '마감일은 YYYY-MM-DD 형식으로 입력해주세요.';
      }
    }
    const parsedStartDate = parseDateValue(startDate);
    const parsedEndDate = parseDateValue(endDate);
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
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
        category,
        startDate: normalizeOptional(startDate),
        endDate: normalizeOptional(endDate),
        purchaseUrl: normalizeOptional(purchaseUrl) ?? instagramUrl.trim(),
        discountInfo: normalizeOptional(discountInfo),
        instagramUrl: instagramUrl.trim(),
        imageUrls: hikerData?.imageUrl ? [hikerData.imageUrl] : [],
        thumbnailUrl: hikerData?.thumbnailUrl ?? undefined,
        videoUrl: hikerData?.videoUrl ?? undefined,
        mediaUrls: hikerData?.mediaUrls ?? [],
        mediaItems: hikerData?.mediaItems ?? [],
        mediaType: hikerData?.mediaType ?? undefined,
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

  function openDatePicker(field: DateFieldKey) {
    const value = field === 'startDate' ? startDate : endDate;
    setCalendarMonth(parseDateValue(value) ?? new Date());
    setDatePickerField(field);
  }

  function handleCalendarDatePress(date: Date) {
    if (isCalendarDateDisabled(date)) return;

    const formatted = formatDateValue(date);
    if (datePickerField === 'startDate') {
      setStartDate(formatted);
    } else if (datePickerField === 'endDate') {
      setEndDate(formatted);
    }
    setFieldErrors({});
    setDatePickerField(null);
  }

  function isCalendarDateDisabled(date: Date): boolean {
    const parsedStartDate = parseDateValue(startDate);
    const parsedEndDate = parseDateValue(endDate);

    if (datePickerField === 'startDate' && parsedEndDate) {
      return date > parsedEndDate;
    }

    if (datePickerField === 'endDate' && parsedStartDate) {
      return date < parsedStartDate;
    }

    return false;
  }

  function clearSelectedDate() {
    if (datePickerField === 'startDate') {
      setStartDate('');
    } else if (datePickerField === 'endDate') {
      setEndDate('');
    }
    setFieldErrors({});
    setDatePickerField(null);
  }

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const selectedDateValue = datePickerField === 'startDate' ? startDate : endDate;
  const selectedDateLabel = selectedDateValue || '선택된 날짜 없음';
  const datePickerTitle = datePickerField === 'startDate' ? '시작일 선택' : '마감일 선택';
  const todayValue = formatDateValue(new Date());
  const shouldShowStickyAction = focusedInputId !== null || keyboardVisible;
  const submitButtonText = isSubmitting ? '제출 중...' : '공구 제보하기';
  const stickyFooter = shouldShowStickyAction ? (
    <View style={[s.stickyActionArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <AppButton
        disabled={isSubmitting}
        onPress={() => void handleSubmit()}
        style={s.stickySubmitButton}
        variant="primary"
      >
        {submitButtonText}
      </AppButton>
      {isSubmitting ? (
        <ActivityIndicator size="small" color={colors.primary} style={s.stickySpinner} />
      ) : null}
    </View>
  ) : null;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={s.safeArea}>
      <Modal
        animationType="fade"
        onShow={() =>
          AccessibilityInfo.announceForAccessibility('제보 완료')
        }
        transparent
        visible={isSuccessModalVisible}
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={s.successBackdrop}>
          <View
            accessibilityLabel="제보 완료"
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={s.successDialog}
            testID="submit-success-dialog"
          >
            <View style={s.successIcon}>
              <SText variant="body" style={s.successIconText}>✓</SText>
            </View>
            <SText accessibilityRole="header" variant="title" style={s.successTitle}>
              제보 완료
            </SText>
            <SText variant="body" style={s.successBody}>
              제보한 공구가 바로 등록됐어요. 홈에서 최신 공구 목록을 다시 불러옵니다.
            </SText>
            <AppButton
              onPress={() => {
                setIsSuccessModalVisible(false);
                navigation.navigate('MainTabs', { screen: 'Home' });
              }}
              style={s.successButton}
              variant="primary"
            >
              홈에서 확인하기
            </AppButton>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onShow={() =>
          AccessibilityInfo.announceForAccessibility(
            `${datePickerTitle} 달력`,
          )
        }
        transparent
        visible={datePickerField !== null}
        onRequestClose={() => setDatePickerField(null)}
      >
        <View style={s.calendarBackdrop}>
          <View
            accessibilityLabel={`${datePickerTitle} 달력`}
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={s.calendarDialog}
            testID="submit-date-picker-dialog"
          >
            <View style={s.calendarTopBar}>
              <View>
                <SText accessibilityRole="header" variant="caption" style={s.calendarEyebrow}>
                  {datePickerTitle}
                </SText>
                <SText variant="title" style={s.calendarSelectedText}>
                  {selectedDateLabel}
                </SText>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setDatePickerField(null)}
                style={s.calendarCloseButton}
              >
                <SText variant="body" style={s.calendarCloseText}>×</SText>
              </Pressable>
            </View>

            <View style={s.calendarHeader}>
              <Pressable
                accessibilityLabel="이전 달"
                accessibilityRole="button"
                onPress={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
                }}
                style={s.calendarNavButton}
              >
                <SText variant="body" style={s.calendarNavText}>‹</SText>
              </Pressable>
              <SText variant="title" style={s.calendarTitle}>
                {getMonthTitle(calendarMonth)}
              </SText>
              <Pressable
                accessibilityLabel="다음 달"
                accessibilityRole="button"
                onPress={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
                }}
                style={s.calendarNavButton}
              >
                <SText variant="body" style={s.calendarNavText}>›</SText>
              </Pressable>
            </View>

            <View style={s.weekdayRow}>
              {WEEKDAY_LABELS.map((day) => (
                <SText key={day} variant="caption" style={s.weekdayText}>
                  {day}
                </SText>
              ))}
            </View>

            <View style={s.calendarGrid}>
              {calendarDays.map((day, index) => {
                const formatted = day ? formatDateValue(day) : '';
                const selected = formatted === selectedDateValue;
                const today = day ? formatted === todayValue : false;
                const disabled = day ? isCalendarDateDisabled(day) : false;
                return (
                  <View key={`${formatted || 'empty'}-${index}`} style={s.calendarCell}>
                    {day ? (
                      <Pressable
                        accessibilityLabel={`${formatted} 선택`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled }}
                        disabled={disabled}
                        onPress={() => handleCalendarDatePress(day)}
                        style={[
                          s.calendarDayButton,
                          today && s.calendarDayToday,
                          selected && s.calendarDaySelected,
                          disabled && s.calendarDayDisabled,
                        ]}
                      >
                        <SText
                          variant="label"
                          style={[
                            s.calendarDayText,
                            today && s.calendarDayTodayText,
                            selected && s.calendarDayTextSelected,
                            disabled && s.calendarDayTextDisabled,
                          ]}
                        >
                          {day.getDate()}
                        </SText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={s.calendarFooter}>
              <Pressable
                accessibilityLabel="날짜 지우기"
                accessibilityRole="button"
                onPress={clearSelectedDate}
                style={s.calendarClearButton}
              >
                <SText variant="label" style={s.calendarClearText}>날짜 지우기</SText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <KeyboardFormScreen
        footer={stickyFooter}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={12}
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
            <Pressable
              accessibilityLabel="인스타그램 게시물 URL"
              accessibilityRole="button"
              onPress={() => urlInputRef.current?.focus()}
              style={s.urlLabelRow}
            >
              <SText variant="label" style={s.urlLabel}>인스타그램 게시물 URL</SText>
              <SText variant="caption" style={s.requiredBadge}>필수</SText>
            </Pressable>
            <View
              style={[
                s.urlInputWrapper,
                isUrlFocused && s.urlInputFocused,
                hikerStatus === 'loading' && s.urlInputLoading,
              ]}
            >
              <View style={s.urlIcon}>
                <SText variant="caption" style={s.urlIconText}>📸</SText>
              </View>
              <TextInput
                ref={urlInputRef}
                value={instagramUrl}
                onChangeText={(v) => {
                  setInstagramUrl(v);
                  setFieldErrors({});
                }}
                onBlur={() => {
                  setIsUrlFocused(false);
                  handleInputBlur('instagramUrl');
                }}
                onFocus={() => {
                  setIsUrlFocused(true);
                  handleInputFocus('instagramUrl');
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
              onBlur={() => handleInputBlur('productName')}
              onFocus={() => handleInputFocus('productName')}
              placeholder="예: 비건 선크림"
              error={fieldErrors.productName}
            />
            <View style={s.categoryField}>
              <View style={s.categoryLabelRow}>
                <SText variant="label" style={s.fieldLabel}>카테고리</SText>
                <SText variant="caption" style={s.requiredBadge}>필수</SText>
              </View>
              <View style={s.categoryGrid}>
                {CATEGORIES.map((item) => {
                  const selected = category === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityLabel={`${item.label} 카테고리 선택`}
                      accessibilityRole="button"
                      onPress={() => setCategory(item.key)}
                      style={[s.categoryChip, selected && s.categoryChipSelected]}
                    >
                      <SText
                        variant="label"
                        style={[s.categoryChipText, selected && s.categoryChipTextSelected]}
                      >
                        {item.label}
                      </SText>
                    </Pressable>
                  );
                })}
              </View>
              {fieldErrors.category ? (
                <SText variant="caption" style={s.fieldError}>{fieldErrors.category}</SText>
              ) : null}
            </View>
            <View style={s.dateRow}>
              <View style={s.dateColumn}>
                <Pressable
                  accessibilityLabel="시작일 선택"
                  accessibilityRole="button"
                  onPress={() => openDatePicker('startDate')}
                  style={s.dateField}
                >
                  <SText
                    variant="label"
                    style={[
                      s.dateLabel,
                      datePickerField === 'startDate' && s.dateLabelFocused,
                    ]}
                  >
                    시작일
                  </SText>
                  <View
                    style={[
                      s.dateInput,
                      datePickerField === 'startDate' && s.dateInputFocused,
                      fieldErrors.startDate && s.dateInputError,
                    ]}
                  >
                    <SText
                      variant="body"
                      style={[s.dateValue, !startDate && s.datePlaceholder]}
                    >
                      {startDate || '날짜 선택'}
                    </SText>
                  </View>
                </Pressable>
                {fieldErrors.startDate ? (
                  <SText variant="caption" style={s.fieldError}>{fieldErrors.startDate}</SText>
                ) : null}
              </View>
              <View style={s.dateColumn}>
                <Pressable
                  accessibilityLabel="마감일 선택"
                  accessibilityRole="button"
                  onPress={() => openDatePicker('endDate')}
                  style={s.dateField}
                >
                  <SText
                    variant="label"
                    style={[
                      s.dateLabel,
                      datePickerField === 'endDate' && s.dateLabelFocused,
                    ]}
                  >
                    마감일
                  </SText>
                  <View
                    style={[
                      s.dateInput,
                      datePickerField === 'endDate' && s.dateInputFocused,
                      fieldErrors.endDate && s.dateInputError,
                    ]}
                  >
                    <SText
                      variant="body"
                      style={[s.dateValue, !endDate && s.datePlaceholder]}
                    >
                      {endDate || '날짜 선택'}
                    </SText>
                  </View>
                </Pressable>
                {fieldErrors.endDate ? (
                  <SText variant="caption" style={s.fieldError}>{fieldErrors.endDate}</SText>
                ) : null}
              </View>
            </View>
            <FormInput
              label="구매 링크"
              value={purchaseUrl}
              onChangeText={setPurchaseUrl}
              onBlur={() => handleInputBlur('purchaseUrl')}
              onFocus={() => handleInputFocus('purchaseUrl')}
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
              onBlur={() => handleInputBlur('discountInfo')}
              onFocus={() => handleInputFocus('discountInfo')}
              placeholder="예: 정가 229,000원 → 29% 163,560원"
              error={fieldErrors.discountInfo}
            />
            <FormInput
              label="요약"
              value={summary}
              onChangeText={setSummary}
              onBlur={() => handleInputBlur('summary')}
              onFocus={() => handleInputFocus('summary')}
              placeholder="공구 한 줄 요약 (최대 500자)"
              multiline
              scrollEnabled
              style={s.summaryInput}
              error={fieldErrors.summary}
            />
          </View>

          {/* ── Action area ────────────────────────────────── */}
          <View style={[s.actionArea, shouldShowStickyAction && s.actionAreaHidden]}>
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
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              style={s.cancelButton}
              accessibilityRole="button"
            >
              <SText variant="body" style={s.cancelText}>
                취소하고 돌아가기
              </SText>
            </Pressable>
          </View>
      </KeyboardFormScreen>
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
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing['2xl'],
      width: '100%',
      maxWidth: 340,
    },
    successIcon: {
      alignItems: 'center',
      backgroundColor: colors.successSoft,
      borderRadius: commerceRadius.full,
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
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    successBody: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
    successButton: {
      alignSelf: 'stretch',
      paddingVertical: 13,
    },

    // Calendar picker
    calendarBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    calendarDialog: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      width: '100%',
      maxWidth: 360,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 12,
    },
    calendarTopBar: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    calendarEyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 3,
    },
    calendarSelectedText: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    calendarCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: commerceRadius.full,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    calendarCloseText: {
      color: colors.muted,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 24,
    },
    calendarHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    calendarNavButton: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    calendarNavText: {
      color: colors.accent,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 28,
    },
    calendarTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 2,
      paddingTop: spacing.sm,
    },
    weekdayText: {
      color: colors.weak,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    calendarCell: {
      alignItems: 'center',
      aspectRatio: 1,
      justifyContent: 'center',
      width: `${100 / 7}%`,
    },
    calendarDayButton: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    calendarDayToday: {
      backgroundColor: colors.bg,
    },
    calendarDaySelected: {
      backgroundColor: colors.accent,
    },
    calendarDayDisabled: {
      opacity: 0.32,
    },
    calendarDayText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    calendarDayTodayText: {
      color: colors.accent,
    },
    calendarDayTextSelected: {
      color: colors.inverse,
    },
    calendarDayTextDisabled: {
      color: colors.weak,
    },
    calendarFooter: {
      alignItems: 'center',
      borderTopColor: colors.borderLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
    },
    calendarClearButton: {
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    calendarClearText: {
      color: colors.weak,
      fontSize: 13,
      fontWeight: '800',
    },

    // Feedback banner
    feedbackBanner: {
      borderRadius: commerceRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    feedback_info: {
      backgroundColor: colors.accentSoft,
    },
    feedback_success: {
      backgroundColor: colors.successSoft,
    },
    feedback_error: {
      backgroundColor: colors.errorSoft,
    },
    feedbackText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    feedbackText_info: {
      color: colors.accent,
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
      color: colors.text,
      fontSize: 15,
      marginRight: spacing.sm,
    },
    requiredBadge: {
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: commerceRadius.sm,
      overflow: 'hidden',
      fontWeight: '600',
      fontSize: 11,
    },
    urlInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: commerceRadius.lg,
      paddingHorizontal: spacing.md,
    },
    urlInputLoading: {
      borderColor: colors.accent,
    },
    urlInputFocused: {
      borderColor: colors.accent,
    },
    urlClearButton: {
      alignItems: 'center',
      height: 24,
      justifyContent: 'center',
      marginLeft: spacing.sm,
      width: 24,
    },
    urlClearIcon: {
      color: colors.weak,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
    },
    urlIcon: {
      width: 28,
      height: 28,
      borderRadius: commerceRadius.full,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    urlIconText: {
      fontSize: 14,
    },
    urlInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
      paddingVertical: 12,
    },

    // Fields section
    fieldsSection: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      color: colors.weak,
      letterSpacing: 0.8,
      marginBottom: spacing.md,
      fontSize: 11,
    },
    categoryField: {
      marginBottom: spacing.md,
    },
    categoryLabelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      minWidth: 76,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    categoryChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    categoryChipText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '800',
    },
    categoryChipTextSelected: {
      color: colors.inverse,
    },
    fieldError: {
      color: colors.error,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    dateColumn: {
      flex: 1,
    },
    dateField: {
      flex: 1,
    },
    dateLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    dateLabelFocused: {
      color: colors.accent,
    },
    dateInput: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: 'transparent',
      borderRadius: commerceRadius.lg,
      borderWidth: 1.5,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    dateInputFocused: {
      borderColor: colors.accent,
    },
    dateInputError: {
      borderColor: colors.error,
    },
    dateValue: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    datePlaceholder: {
      color: colors.weak,
      fontWeight: '400',
    },
    summaryInput: {
      maxHeight: 144,
    },
    // Action area
    actionArea: {
      gap: spacing.md,
    },
    actionAreaHidden: {
      display: 'none',
    },
    submitButton: {
      borderRadius: commerceRadius.lg,
      height: 54,
      justifyContent: 'center',
      paddingVertical: 0,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    stickyActionArea: {
      backgroundColor: colors.bg,
      borderTopColor: colors.borderLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    stickySubmitButton: {
      borderRadius: commerceRadius.lg,
      height: 54,
      justifyContent: 'center',
      paddingVertical: 0,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    stickySpinner: {
      marginTop: spacing.xs,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    cancelText: {
      color: colors.weak,
      fontSize: 13,
    },
    spinner: {
      marginTop: spacing.xs,
    },
  });
}
