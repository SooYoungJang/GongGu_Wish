import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SText } from '../components/ui/SText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, useQuery } from '@tanstack/react-query';

import { deleteAdminJson, fetchAdminJson, fetchAdminSubmissions, patchAdminJson, postAdminJson } from '../api';
import { AppButton } from '../components/AppButton';
import { FormInput } from '../components/FormInput';
import { InfoRow } from '../components/InfoRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { ThemeToggle } from '../components/ThemeToggle';
import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type {
  Influencer,
  InfluencerForm,
  ManualSubmissionForm,
  Submission,
  SubmissionReviewForm,
  AdminScreenProps,
} from '../types';
import { createReviewForm } from '../utils';

// Create a dedicated client for admin queries to avoid duplicate invalidation issues
const adminQueryClient = new QueryClient();

export function AdminScreen({ navigation }: AdminScreenProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const emptyManualForm: ManualSubmissionForm = {
    influencerUsername: '',
    influencerDisplayName: '',
    caption: '',
    postUrl: '',
    imageUrl: '',
    productName: '',
    brandName: '',
    startDate: '',
    endDate: '',
    purchaseUrl: '',
    discountInfo: '',
    summary: '',
  };
  const [form, setForm] = useState<ManualSubmissionForm>(emptyManualForm);
  const [influencerForm, setInfluencerForm] = useState<InfluencerForm>({
    instagramUsername: '',
    displayName: '',
  });
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<SubmissionReviewForm | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const influencersQuery = useQuery({
    queryKey: ['admin', 'influencers'],
    queryFn: () => fetchAdminJson<Influencer[]>('/admin/influencers'),
    retry: false,
  });
  const submissionsQuery = useQuery({
    queryKey: ['admin', 'submissions'],
    queryFn: fetchAdminSubmissions,
    retry: false,
  });

  const selectedSubmission = (submissionsQuery.data ?? []).find(
    (item) => item.id === selectedSubmissionId,
  );

  async function refreshAdminData() {
    await Promise.all([influencersQuery.refetch(), submissionsQuery.refetch()]);
  }

  function selectSubmission(item: Submission) {
    setSelectedSubmissionId(item.id);
    setReviewForm(createReviewForm(item));
    setRejectReason('');
  }

  async function createInfluencer() {
    if (!influencerForm.instagramUsername.trim() || !influencerForm.displayName.trim()) {
      setFeedback('인스타 핸들과 표시명은 필수입니다.');
      return;
    }

    const normalizedUsername = influencerForm.instagramUsername.trim().replace(/^@/, '');
    const duplicate = (influencersQuery.data ?? []).find(
      (item) => item.instagramUsername.toLowerCase() === normalizedUsername.toLowerCase() && item.isActive,
    );
    if (duplicate) {
      setFeedback('이미 등록된 인스타 계정입니다.');
      return;
    }

    setFeedback('인스타 계정 등록 중...');
    await postAdminJson('/admin/influencers', {
      instagramUsername: normalizedUsername,
      displayName: influencerForm.displayName.trim(),
    });
    setInfluencerForm({ instagramUsername: '', displayName: '' });
    setFeedback('인스타 계정이 활성 상태로 등록되었습니다.');
    await influencersQuery.refetch();
  }

  async function deactivateInfluencer(id: string) {
    setFeedback('인스타 계정 비활성화 중...');
    await deleteAdminJson(`/admin/influencers/${id}`);
    setFeedback('계정 비활성화 완료: 기존 승인 공구는 유지되고 신규 수집 대상에서 제외됩니다.');
    await influencersQuery.refetch();
  }

  async function submitManualSubmission() {
    if (!form.influencerUsername.trim() || !form.postUrl.trim() || !form.productName.trim() || !form.caption.trim()) {
      setFeedback('인스타 username, 게시물 URL, 제품명, 캡션은 필수입니다.');
      return;
    }

    setFeedback('수동 제보 등록 중...');
    await postAdminJson('/admin/submissions', {
      ...form,
      influencerUsername: form.influencerUsername.trim().replace(/^@/, ''),
      influencerDisplayName: form.influencerDisplayName || undefined,
      imageUrl: form.imageUrl || undefined,
      brandName: form.brandName || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      purchaseUrl: form.purchaseUrl || undefined,
      discountInfo: form.discountInfo || undefined,
      summary: form.summary || undefined,
    });
    setForm(emptyManualForm);
    setFeedback('제보가 검수 큐에 등록되었습니다. 승인하면 앱 목록/캘린더 데이터에 반영됩니다.');
    await refreshAdminData();
  }

  async function saveReviewFields(id: string) {
    if (!reviewForm) {
      return;
    }

    setFeedback('후보 상세 수정사항 저장 중...');
    const updated = await patchAdminJson<Submission>(`/admin/submissions/${id}`, {
      productName: reviewForm.productName || undefined,
      brandName: reviewForm.brandName || undefined,
      startDate: reviewForm.startDate || undefined,
      endDate: reviewForm.endDate || undefined,
      purchaseUrl: reviewForm.purchaseUrl || undefined,
      discountInfo: reviewForm.discountInfo || undefined,
      summary: reviewForm.summary || undefined,
    });
    setReviewForm(createReviewForm(updated));
    setFeedback('후보 상세 수정사항을 저장했습니다.');
    await submissionsQuery.refetch();
  }

  async function moderateSubmission(id: string, action: 'approve' | 'reject') {
    if (reviewForm) {
      await saveReviewFields(id);
    }

    if (action === 'approve' && (!reviewForm?.productName.trim() || (!reviewForm.startDate.trim() && !reviewForm.endDate.trim()))) {
      setFeedback('승인 전 제품명과 시작/종료일 중 최소 1개 날짜가 필요합니다.');
      return;
    }
    if (action === 'reject' && !rejectReason.trim()) {
      setFeedback('반려 사유는 필수입니다. 예: 공구 아님 / 정보 부족 / 중복');
      return;
    }

    setFeedback(action === 'approve' ? '승인 처리 중...' : `반려 처리 중... 사유: ${rejectReason}`);
    await postAdminJson(`/admin/group-buys/${id}/${action}`, action === 'reject' ? { reason: rejectReason } : undefined);
    setFeedback(action === 'approve' ? '승인 완료: 앱 목록/캘린더 데이터에 노출됩니다.' : '반려 완료: 사용자 화면에 노출되지 않습니다.');
    await refreshAdminData();
  }

  const hasAdminError = influencersQuery.isError || submissionsQuery.isError;
  const pendingCount = (submissionsQuery.data ?? []).filter((item) => item.status === 'REVIEW_REQUIRED').length;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Admin MVP"
          title="운영자 관리자"
          subtitle="인스타 계정 등록/비활성화, 공구 후보 목록·상세, 승인/반려를 한 화면에서 처리합니다."
        >
          <View style={s.actionRow}>
            <SText variant="badge" style={{ backgroundColor: colors.warningBg, borderRadius: commerceRadius.full, color: colors.noticeText, paddingHorizontal: 10, paddingVertical: 4 }}>검수 대기 {pendingCount}건</SText>
            <SText variant="badge" style={{ backgroundColor: colors.warningBg, borderRadius: commerceRadius.full, color: colors.noticeText, paddingHorizontal: 10, paddingVertical: 4 }}>soft delete: 비활성화</SText>
          </View>
        </ScreenHeader>

        {/* Theme toggle */}
        <View style={[s.card, { marginBottom: spacing.md }]}>
          <SText variant="cardTitle">화면 설정</SText>
          <ThemeToggle />
        </View>

        {hasAdminError ? (
          <View style={s.notice}>
            <SText variant="caption" style={{ color: colors.noticeText, textAlign: 'center' }}>
              Admin API 호출 실패. API 서버가 켜져 있고 ADMIN_TOKEN 설정 시 브라우저 localStorage의 gonggu.adminToken 값이 맞는지 확인하세요.
            </SText>
          </View>
        ) : null}

        {feedback ? (
          <View style={s.notice}>
            <SText variant="caption" style={{ color: colors.noticeText, textAlign: 'center' }}>{feedback}</SText>
          </View>
        ) : null}

        <View style={s.card}>
          <SText variant="cardTitle">인스타 계정 관리</SText>
          <FormInput label="핸들 *" value={influencerForm.instagramUsername} onChangeText={(value) => setInfluencerForm({ ...influencerForm, instagramUsername: value })} />
          <FormInput label="표시명 *" value={influencerForm.displayName} onChangeText={(value) => setInfluencerForm({ ...influencerForm, displayName: value })} />
          <Pressable onPress={() => void createInfluencer().catch((error: Error) => setFeedback(error.message))} style={s.primaryButton}>
            <SText variant="label" style={{ color: colors.textInverse, fontSize: 16 }}>계정 등록</SText>
          </Pressable>
          {(influencersQuery.data ?? []).map((item) => (
            <View key={item.id} style={s.infoRow}>
              <SText variant="body" style={{ color: colors.textPrimary, flex: 1 }}>@{item.instagramUsername} · {item.displayName ?? '표시명 없음'} · {item.isActive ? '활성' : '비활성'}</SText>
              {item.isActive ? (
                <Pressable onPress={() => void deactivateInfluencer(item.id).catch((error: Error) => setFeedback(error.message))} style={s.secondaryButton}>
                  <SText variant="label">비활성화</SText>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View style={s.card}>
          <SText variant="cardTitle">수동 공구 제보 등록</SText>
          <FormInput label="인스타 *" value={form.influencerUsername} onChangeText={(value) => setForm({ ...form, influencerUsername: value })} />
          <FormInput label="표시명" value={form.influencerDisplayName} onChangeText={(value) => setForm({ ...form, influencerDisplayName: value })} />
          <FormInput label="게시물 URL *" value={form.postUrl} onChangeText={(value) => setForm({ ...form, postUrl: value })} />
          <FormInput label="이미지 URL" value={form.imageUrl} onChangeText={(value) => setForm({ ...form, imageUrl: value })} />
          <FormInput label="제품명 *" value={form.productName} onChangeText={(value) => setForm({ ...form, productName: value })} />
          <FormInput label="브랜드" value={form.brandName} onChangeText={(value) => setForm({ ...form, brandName: value })} />
          <FormInput label="시작일 ISO" value={form.startDate} onChangeText={(value) => setForm({ ...form, startDate: value })} />
          <FormInput label="종료일 ISO" value={form.endDate} onChangeText={(value) => setForm({ ...form, endDate: value })} />
          <FormInput label="구매 URL" value={form.purchaseUrl} onChangeText={(value) => setForm({ ...form, purchaseUrl: value })} />
          <FormInput label="혜택" value={form.discountInfo} onChangeText={(value) => setForm({ ...form, discountInfo: value })} />
          <FormInput label="캡션 *" multiline value={form.caption} onChangeText={(value) => setForm({ ...form, caption: value })} />
          <FormInput label="요약" multiline value={form.summary} onChangeText={(value) => setForm({ ...form, summary: value })} />
          <Pressable onPress={() => void submitManualSubmission().catch((error: Error) => setFeedback(error.message))} style={s.primaryButton}>
            <SText variant="label" style={{ color: colors.textInverse, fontSize: 16 }}>제보 등록</SText>
          </Pressable>
        </View>

        <View style={s.card}>
          <SText variant="cardTitle">공구 후보 목록</SText>
          {submissionsQuery.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
          {(submissionsQuery.data ?? []).map((item) => (
            <Pressable key={item.id} onPress={() => selectSubmission(item)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
              <View style={s.cardHeader}>
                <SText variant="label" style={{ color: colors.primary }}>#{item.id.slice(0, 8)} · @{item.rawPost.influencer.instagramUsername}</SText>
                <SText variant="badge" style={{ backgroundColor: colors.warningBg, borderRadius: commerceRadius.full, color: colors.noticeText, paddingHorizontal: 10, paddingVertical: 4 }}>{item.status}</SText>
              </View>
              <SText variant="cardTitle">{item.productName ?? '추정 공구명 미확인'}</SText>
              <SText variant="body" style={{ marginBottom: spacing.sm }}>{item.brandName ?? '브랜드 미확인'} · 출처 {item.rawPost.instagramPostId?.startsWith('manual:') ? '운영자 등록' : '수집/제보'}</SText>
              <SText variant="body">{item.summary ?? item.rawPost.caption}</SText>
              <SText variant="label">상세 보기 / 승인 / 반려</SText>
            </Pressable>
          ))}
        </View>

        {selectedSubmission && reviewForm ? (
          <View style={s.card}>
            <SText variant="cardTitle">공구 후보 상세</SText>
            <InfoRow label="후보 ID" value={selectedSubmission.id} />
            <InfoRow label="계정" value={`@${selectedSubmission.rawPost.influencer.instagramUsername}`} />
            <InfoRow label="원문 URL" value={selectedSubmission.rawPost.postUrl} />
            <InfoRow label="이미지" value={selectedSubmission.rawPost.imageUrl ?? '없음'} />
            <InfoRow label="상태" value={selectedSubmission.status} />
            <InfoRow label="반려 사유" value={selectedSubmission.rejectionReason} />
            <InfoRow label="검수일" value={selectedSubmission.reviewedAt} />
            <InfoRow label="원문" value={selectedSubmission.rawPost.caption} />
            <FormInput label="상품명 *" value={reviewForm.productName} onChangeText={(value) => setReviewForm({ ...reviewForm, productName: value })} />
            <FormInput label="브랜드" value={reviewForm.brandName} onChangeText={(value) => setReviewForm({ ...reviewForm, brandName: value })} />
            <FormInput label="시작일 ISO" value={reviewForm.startDate} onChangeText={(value) => setReviewForm({ ...reviewForm, startDate: value })} />
            <FormInput label="종료일 ISO" value={reviewForm.endDate} onChangeText={(value) => setReviewForm({ ...reviewForm, endDate: value })} />
            <FormInput label="구매 URL" value={reviewForm.purchaseUrl} onChangeText={(value) => setReviewForm({ ...reviewForm, purchaseUrl: value })} />
            <FormInput label="혜택" value={reviewForm.discountInfo} onChangeText={(value) => setReviewForm({ ...reviewForm, discountInfo: value })} />
            <FormInput label="설명/메모" multiline value={reviewForm.summary} onChangeText={(value) => setReviewForm({ ...reviewForm, summary: value })} />
            <Pressable onPress={() => void saveReviewFields(selectedSubmission.id).catch((error: Error) => setFeedback(error.message))} style={s.secondaryButton}>
              <SText variant="label">상세 수정 저장</SText>
            </Pressable>
            <FormInput label="반려 사유 *" value={rejectReason} onChangeText={setRejectReason} />
            <View style={s.actionRow}>
              <Pressable onPress={() => void moderateSubmission(selectedSubmission.id, 'approve').catch((error: Error) => setFeedback(error.message))} style={s.primaryButton}>
                <SText variant="label" style={{ color: colors.textInverse, fontSize: 16 }}>승인 및 반영</SText>
              </Pressable>
              <Pressable onPress={() => void moderateSubmission(selectedSubmission.id, 'reject').catch((error: Error) => setFeedback(error.message))} style={s.secondaryButton}>
                <SText variant="label">반려 처리</SText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
    notice: { backgroundColor: colors.warningSoft, borderRadius: commerceRadius.lg, marginBottom: spacing.lg, padding: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.lg,
    },
    cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    infoRow: { borderBottomColor: colors.borderLight, borderBottomWidth: 1, flexDirection: 'row', marginBottom: spacing.md, paddingBottom: spacing.md },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.lg,
      marginTop: spacing.lg,
      paddingVertical: 14,
    },
    secondaryButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
    },
    pressed: { opacity: 0.8 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  });
}
