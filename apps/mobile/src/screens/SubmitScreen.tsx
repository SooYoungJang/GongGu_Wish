import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubmissionGuard } from '@gonggu/shared/hooks';

import { postPublicJson } from '../api';
import { AppButton } from '../components/AppButton';
import { FormInput } from '../components/FormInput';
import { InstagramCard } from '../components/InstagramCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, borderRadius, spacing } from '../design/tokens';
import type { PublicSubmissionForm, SubmitScreenProps } from '../types';
import { isValidOptionalUrl, normalizeOptional } from '../utils';

export function SubmitScreen({ navigation }: SubmitScreenProps) {
  const emptyForm: PublicSubmissionForm = {
    productName: '',
    brandName: '',
    startDate: '',
    endDate: '',
    purchaseUrl: '',
    discountInfo: '',
    instagramUrl: '',
    imageUrl: '',
    summary: '',
  };
  const [form, setForm] = useState<PublicSubmissionForm>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { isDispatched, guard, reset } = useSubmissionGuard();

  function validateForm() {
    if (form.productName.trim().length < 2) {
      return '제품명은 2자 이상 필수입니다.';
    }
    if (!isValidOptionalUrl(form.purchaseUrl)) {
      return '구매 링크는 http(s) URL 형식이어야 합니다.';
    }
    if (!isValidOptionalUrl(form.instagramUrl)) {
      return '인스타그램 URL은 http(s) URL 형식이어야 합니다.';
    }
    if (!isValidOptionalUrl(form.imageUrl)) {
      return '이미지 URL은 http(s) URL 형식이어야 합니다.';
    }
    if (form.startDate.trim() && form.endDate.trim()) {
      const start = new Date(form.startDate.trim());
      const end = new Date(form.endDate.trim());
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return '날짜는 YYYY-MM-DD 또는 ISO 형식으로 입력해주세요.';
      }
      if (start > end) {
        return '시작일은 종료일보다 늦을 수 없습니다.';
      }
    }
    return null;
  }

  async function submitPublicSubmission() {
    const validationError = validateForm();
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!guard()) return;

    setFeedback('제보를 접수하는 중입니다...');
    try {
      await postPublicJson('/submissions', {
        productName: form.productName.trim(),
        brandName: normalizeOptional(form.brandName),
        startDate: normalizeOptional(form.startDate),
        endDate: normalizeOptional(form.endDate),
        purchaseUrl: normalizeOptional(form.purchaseUrl),
        discountInfo: normalizeOptional(form.discountInfo),
        instagramUrl: normalizeOptional(form.instagramUrl),
        imageUrls: normalizeOptional(form.imageUrl) ? [form.imageUrl.trim()] : [],
        summary: normalizeOptional(form.summary),
        isAnonymous: true,
      });
      setFeedback('제보가 접수되었습니다. 운영자 승인 후 캘린더에 반영됩니다.');
      setForm(emptyForm);
      setTimeout(() => navigation.navigate('Home'), 700);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '제보 접수에 실패했습니다.');
    } finally {
      reset();
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="User Submission"
          title="공구 제보하기"
          subtitle="발견한 공동구매 정보를 알려주세요. 필수 제품명만 있어도 접수되며, 운영자 승인 후 캘린더에 노출됩니다."
        />

        {feedback ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{feedback}</Text>
          </View>
        ) : null}

        <InstagramCard>
          <FormInput label="제품명 *" value={form.productName} onChangeText={(value) => setForm({ ...form, productName: value })} />
          <FormInput label="브랜드" value={form.brandName} onChangeText={(value) => setForm({ ...form, brandName: value })} />
          <FormInput label="시작일 (YYYY-MM-DD)" value={form.startDate} onChangeText={(value) => setForm({ ...form, startDate: value })} />
          <FormInput label="종료일 (YYYY-MM-DD)" value={form.endDate} onChangeText={(value) => setForm({ ...form, endDate: value })} />
          <FormInput label="구매 링크" value={form.purchaseUrl} onChangeText={(value) => setForm({ ...form, purchaseUrl: value })} />
          <FormInput label="할인 정보" value={form.discountInfo} onChangeText={(value) => setForm({ ...form, discountInfo: value })} />
          <FormInput label="인스타그램 URL" value={form.instagramUrl} onChangeText={(value) => setForm({ ...form, instagramUrl: value })} />
          <FormInput label="이미지 URL" value={form.imageUrl} onChangeText={(value) => setForm({ ...form, imageUrl: value })} />
          <FormInput label="요약" multiline value={form.summary} onChangeText={(value) => setForm({ ...form, summary: value })} />

          <View style={styles.actionRow}>
            <AppButton disabled={isDispatched} onPress={() => void submitPublicSubmission()} style={styles.flexButton}>
              {isDispatched ? '제출 중...' : '제보 제출'}
            </AppButton>
            <AppButton onPress={() => navigation.navigate('Home')} variant="secondary" style={styles.cancelButton}>
              취소
            </AppButton>
          </View>
        </InstagramCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.sm, marginBottom: spacing.lg, padding: spacing.md },
  noticeText: { color: colors.noticeText, fontSize: 13, textAlign: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1, marginTop: 0 },
  cancelButton: { marginTop: 0 },
});
