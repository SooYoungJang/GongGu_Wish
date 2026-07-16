import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { deleteAdminJson, fetchAdminJson, fetchAdminSubmissions, patchAdminJson, postAdminJson } from '../api';
import { CommerceCard, CommerceChip, CommerceSearchField, CommerceSurface } from '../components/commerce';
import { FormInput } from '../components/FormInput';
import { InfoRow } from '../components/InfoRow';
import { ThemeToggle } from '../components/ThemeToggle';
import { SText } from '../components/ui/SText';
import { commerceRadius, commerceSpacing, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { Influencer, InfluencerForm, ManualSubmissionForm, Submission, SubmissionReviewForm } from '../types';
import { createReviewForm } from '../utils';

type AdminSection = 'review' | 'influencers' | 'manual';
type SubmissionFilter = 'all' | 'pending' | 'approved' | 'rejected';

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

const sectionTabs: Array<{ key: AdminSection; label: string; description: string }> = [
  { key: 'review', label: '검수', description: '승인 대기 공구 처리' },
  { key: 'influencers', label: '계정', description: '인플루언서 등록/비활성화' },
  { key: 'manual', label: '수동 등록', description: '운영자가 직접 제보 추가' },
];

const filters: Array<{ key: SubmissionFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
];

export function AdminScreen() {
  const { colors, shadow } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [activeSection, setActiveSection] = useState<AdminSection>('review');
  const [filter, setFilter] = useState<SubmissionFilter>('pending');
  const [query, setQuery] = useState('');
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
  });
  const submissionsQuery = useQuery({
    queryKey: ['admin', 'submissions'],
    queryFn: fetchAdminSubmissions,
  });

  const influencers = influencersQuery.data ?? [];
  const submissions = submissionsQuery.data ?? [];
  const selectedSubmission = submissions.find((item) => item.id === selectedSubmissionId);
  const activeInfluencerCount = influencers.filter((item) => item.isActive).length;
  const pendingCount = submissions.filter((item) => item.status === 'REVIEW_REQUIRED').length;
  const approvedCount = submissions.filter((item) => item.status === 'APPROVED').length;
  const rejectedCount = submissions.filter((item) => item.status === 'REJECTED').length;
  const hasAdminError = influencersQuery.isError || submissionsQuery.isError;

  const visibleSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return submissions.filter((item) => {
      const statusMatched =
        filter === 'all' ||
        (filter === 'pending' && item.status === 'REVIEW_REQUIRED') ||
        (filter === 'approved' && item.status === 'APPROVED') ||
        (filter === 'rejected' && item.status === 'REJECTED');
      if (!statusMatched) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        item.productName,
        item.brandName,
        item.summary,
        item.rawPost.caption,
        item.rawPost.influencer.instagramUsername,
        item.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, submissions]);

  async function refreshAdminData() {
    await Promise.all([influencersQuery.refetch(), submissionsQuery.refetch()]);
  }

  function selectSubmission(item: Submission) {
    setActiveSection('review');
    setSelectedSubmissionId(item.id);
    setReviewForm(createReviewForm(item));
    setRejectReason('');
  }

  async function createInfluencer() {
    if (!influencerForm.instagramUsername.trim() || !influencerForm.displayName.trim()) {
      setFeedback('핸들과 표시명을 모두 입력해 주세요.');
      return;
    }

    const normalizedUsername = influencerForm.instagramUsername.trim().replace(/^@/, '');
    const duplicate = influencers.find(
      (item) => item.instagramUsername.toLowerCase() === normalizedUsername.toLowerCase() && item.isActive,
    );
    if (duplicate) {
      setFeedback('이미 활성 상태로 등록된 계정입니다.');
      return;
    }

    setFeedback('인플루언서 계정을 등록하는 중입니다.');
    await postAdminJson('/admin/influencers', {
      instagramUsername: normalizedUsername,
      displayName: influencerForm.displayName.trim(),
    });
    setInfluencerForm({ instagramUsername: '', displayName: '' });
    setFeedback('계정을 등록했습니다.');
    await influencersQuery.refetch();
  }

  async function deactivateInfluencer(id: string) {
    setFeedback('계정을 비활성화하는 중입니다.');
    await deleteAdminJson(`/admin/influencers/${id}`);
    setFeedback('계정을 비활성화했습니다. 기존 승인 공구는 유지됩니다.');
    await influencersQuery.refetch();
  }

  async function submitManualSubmission() {
    if (!form.influencerUsername.trim() || !form.postUrl.trim() || !form.productName.trim() || !form.caption.trim()) {
      setFeedback('인플루언서, 게시물 URL, 상품명, 캡션은 필수입니다.');
      return;
    }

    setFeedback('수동 제보를 등록하는 중입니다.');
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
    setFeedback('제보를 검수 대기 목록에 등록했습니다.');
    setActiveSection('review');
    setFilter('pending');
    await refreshAdminData();
  }

  async function saveReviewFields(id: string) {
    if (!reviewForm) return;

    setFeedback('검수 상세를 저장하는 중입니다.');
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
    setFeedback('검수 상세를 저장했습니다.');
    await submissionsQuery.refetch();
  }

  async function moderateSubmission(id: string, action: 'approve' | 'reject') {
    if (action === 'approve' && (!reviewForm?.productName.trim() || (!reviewForm.startDate.trim() && !reviewForm.endDate.trim()))) {
      setFeedback('승인하려면 상품명과 시작일/종료일 중 하나가 필요합니다.');
      return;
    }
    if (action === 'reject' && !rejectReason.trim()) {
      setFeedback('반려 사유를 입력해 주세요. 예: 공구 아님 / 정보 부족 / 중복');
      return;
    }

    if (reviewForm) {
      await saveReviewFields(id);
    }

    setFeedback(action === 'approve' ? '승인 처리 중입니다.' : `반려 처리 중입니다. 사유: ${rejectReason}`);
    await postAdminJson(`/admin/group-buys/${id}/${action}`, action === 'reject' ? { reason: rejectReason } : undefined);
    setFeedback(action === 'approve' ? '승인 완료. 홈 목록과 캘린더에 반영됩니다.' : '반려 완료. 사용자 화면에는 노출되지 않습니다.');
    setSelectedSubmissionId(null);
    setReviewForm(null);
    setRejectReason('');
    await refreshAdminData();
  }

  const keyboardBehavior = Platform.select({
    ios: 'padding' as const,
    android: undefined,
    default: undefined,
  });

  return (
    <CommerceSurface>
      <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
        <KeyboardAvoidingView behavior={keyboardBehavior} style={s.keyboardView}>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.header}>
              <View style={s.headerTop}>
                <View style={s.headerText}>
                  <SText variant="eyebrow" style={s.eyebrow}>Admin</SText>
                  <SText variant="title" style={s.title}>운영 관리자</SText>
                  <SText variant="subtitle" style={s.subtitle}>
                    모바일에서는 필요한 작업만 탭으로 나누고, 검수 대기 항목을 먼저 처리합니다.
                  </SText>
                </View>
                <ThemeToggle />
              </View>
            </View>

            <View style={s.statsGrid}>
              <MetricCard label="검수 대기" value={`${pendingCount}`} tone="warning" colors={colors} />
              <MetricCard label="승인 완료" value={`${approvedCount}`} tone="success" colors={colors} />
              <MetricCard label="반려" value={`${rejectedCount}`} tone="error" colors={colors} />
              <MetricCard label="활성 계정" value={`${activeInfluencerCount}`} tone="blue" colors={colors} />
            </View>

            {hasAdminError ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>
                  Admin API 호출에 실패했습니다. API 서버와 관리자 토큰 설정을 확인해 주세요.
                </SText>
              </View>
            ) : null}

            {feedback ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>{feedback}</SText>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabRail}
            >
              {sectionTabs.map((tab) => (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeSection === tab.key }}
                  onPress={() => setActiveSection(tab.key)}
                  style={({ pressed }) => [
                    s.sectionTab,
                    activeSection === tab.key && s.sectionTabActive,
                    pressed && s.pressed,
                  ]}
                >
                  <SText variant="label" style={[s.sectionTabLabel, activeSection === tab.key && s.sectionTabLabelActive]}>
                    {tab.label}
                  </SText>
                  <SText variant="caption" style={[s.sectionTabMeta, activeSection === tab.key && s.sectionTabMetaActive]}>
                    {tab.description}
                  </SText>
                </Pressable>
              ))}
            </ScrollView>

            {activeSection === 'review' ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View>
                    <SText variant="cardTitle" style={s.sectionTitle}>검수 큐</SText>
                    <SText variant="caption" style={s.sectionMeta}>
                      {visibleSubmissions.length}건 표시 중
                    </SText>
                  </View>
                  {submissionsQuery.isFetching ? <ActivityIndicator color={colors.accent} /> : null}
                </View>

                <CommerceSearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="상품명, 브랜드, 계정 검색"
                  style={s.search}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRail}>
                  {filters.map((item) => (
                    <CommerceChip
                      key={item.key}
                      label={item.label}
                      selected={filter === item.key}
                      onPress={() => setFilter(item.key)}
                    />
                  ))}
                </ScrollView>

                {visibleSubmissions.length === 0 ? (
                  <EmptyState
                    title="표시할 검수 항목이 없습니다."
                    body="필터나 검색어를 바꾸면 다른 상태의 공구를 볼 수 있습니다."
                    colors={colors}
                  />
                ) : null}

                {visibleSubmissions.map((item) => (
                  <SubmissionCard
                    key={item.id}
                    colors={colors}
                    item={item}
                    onPress={() => selectSubmission(item)}
                    selected={item.id === selectedSubmissionId}
                    styles={s}
                  />
                ))}
              </View>
            ) : null}

            {activeSection === 'influencers' ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View>
                    <SText variant="cardTitle" style={s.sectionTitle}>계정 관리</SText>
                    <SText variant="caption" style={s.sectionMeta}>
                      활성 {activeInfluencerCount}명 / 전체 {influencers.length}명
                    </SText>
                  </View>
                  {influencersQuery.isFetching ? <ActivityIndicator color={colors.accent} /> : null}
                </View>

                <CommerceCard style={[s.formPanel, shadow]}>
                  <FormInput
                    label="인스타그램 핸들 *"
                    value={influencerForm.instagramUsername}
                    autoCapitalize="none"
                    onChangeText={(value) => setInfluencerForm({ ...influencerForm, instagramUsername: value })}
                  />
                  <FormInput
                    label="표시명 *"
                    value={influencerForm.displayName}
                    onChangeText={(value) => setInfluencerForm({ ...influencerForm, displayName: value })}
                  />
                  <PrimaryButton label="계정 등록" colors={colors} onPress={() => void createInfluencer().catch((error: Error) => setFeedback(error.message))} />
                </CommerceCard>

                {influencers.map((item) => (
                  <CommerceCard key={item.id} style={s.listCard}>
                    <View style={s.cardHeader}>
                      <View style={s.cardTitleBlock}>
                        <SText variant="cardTitle" style={s.itemTitle}>@{item.instagramUsername}</SText>
                        <SText variant="body" style={s.itemMeta}>{item.displayName ?? '표시명 없음'}</SText>
                      </View>
                      <StatusPill label={item.isActive ? '활성' : '비활성'} tone={item.isActive ? 'success' : 'muted'} colors={colors} />
                    </View>
                    {item.isActive ? (
                      <SecondaryButton label="비활성화" colors={colors} onPress={() => void deactivateInfluencer(item.id).catch((error: Error) => setFeedback(error.message))} />
                    ) : null}
                  </CommerceCard>
                ))}
              </View>
            ) : null}

            {activeSection === 'manual' ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View>
                    <SText variant="cardTitle" style={s.sectionTitle}>수동 제보 등록</SText>
                    <SText variant="caption" style={s.sectionMeta}>필수값만 먼저 입력하고, 세부 정보는 검수에서 보완합니다.</SText>
                  </View>
                </View>

                <CommerceCard style={[s.formPanel, shadow]}>
                  <FormInput label="인플루언서 *" value={form.influencerUsername} autoCapitalize="none" onChangeText={(value) => setForm({ ...form, influencerUsername: value })} />
                  <FormInput label="표시명" value={form.influencerDisplayName} onChangeText={(value) => setForm({ ...form, influencerDisplayName: value })} />
                  <FormInput label="게시물 URL *" value={form.postUrl} autoCapitalize="none" onChangeText={(value) => setForm({ ...form, postUrl: value })} />
                  <FormInput label="이미지 URL" value={form.imageUrl} autoCapitalize="none" onChangeText={(value) => setForm({ ...form, imageUrl: value })} />
                  <FormInput label="상품명 *" value={form.productName} onChangeText={(value) => setForm({ ...form, productName: value })} />
                  <FormInput label="브랜드" value={form.brandName} onChangeText={(value) => setForm({ ...form, brandName: value })} />
                  <View style={s.twoColumn}>
                    <View style={s.twoColumnItem}>
                      <FormInput label="시작일 ISO" value={form.startDate} onChangeText={(value) => setForm({ ...form, startDate: value })} />
                    </View>
                    <View style={s.twoColumnItem}>
                      <FormInput label="종료일 ISO" value={form.endDate} onChangeText={(value) => setForm({ ...form, endDate: value })} />
                    </View>
                  </View>
                  <FormInput label="구매 URL" value={form.purchaseUrl} autoCapitalize="none" onChangeText={(value) => setForm({ ...form, purchaseUrl: value })} />
                  <FormInput label="혜택" value={form.discountInfo} onChangeText={(value) => setForm({ ...form, discountInfo: value })} />
                  <FormInput label="캡션 *" multiline value={form.caption} onChangeText={(value) => setForm({ ...form, caption: value })} />
                  <FormInput label="요약" multiline value={form.summary} onChangeText={(value) => setForm({ ...form, summary: value })} />
                  <PrimaryButton label="제보 등록" colors={colors} onPress={() => void submitManualSubmission().catch((error: Error) => setFeedback(error.message))} />
                </CommerceCard>
              </View>
            ) : null}

            {selectedSubmission && reviewForm ? (
              <CommerceCard style={[s.detailPanel, shadow]}>
                <View style={s.detailHeader}>
                  <View style={s.cardTitleBlock}>
                    <SText variant="eyebrow" style={s.eyebrow}>Selected</SText>
                    <SText variant="cardTitle" style={s.sectionTitle}>검수 상세</SText>
                  </View>
                  <StatusPill label={formatStatus(selectedSubmission.status)} tone={statusTone(selectedSubmission.status)} colors={colors} />
                </View>

                <View style={s.infoBlock}>
                  <InfoRow label="계정" value={`@${selectedSubmission.rawPost.influencer.instagramUsername}`} />
                  <InfoRow label="원문 URL" value={selectedSubmission.rawPost.postUrl} />
                  <InfoRow label="이미지" value={selectedSubmission.rawPost.imageUrl ?? '없음'} />
                  <InfoRow label="검수일" value={formatDate(selectedSubmission.reviewedAt)} />
                  <InfoRow label="반려 사유" value={selectedSubmission.rejectionReason} />
                  <InfoRow label="원문" value={selectedSubmission.rawPost.caption} />
                </View>

                <FormInput label="상품명 *" value={reviewForm.productName} onChangeText={(value) => setReviewForm({ ...reviewForm, productName: value })} />
                <FormInput label="브랜드" value={reviewForm.brandName} onChangeText={(value) => setReviewForm({ ...reviewForm, brandName: value })} />
                <View style={s.twoColumn}>
                  <View style={s.twoColumnItem}>
                    <FormInput label="시작일 ISO" value={reviewForm.startDate} onChangeText={(value) => setReviewForm({ ...reviewForm, startDate: value })} />
                  </View>
                  <View style={s.twoColumnItem}>
                    <FormInput label="종료일 ISO" value={reviewForm.endDate} onChangeText={(value) => setReviewForm({ ...reviewForm, endDate: value })} />
                  </View>
                </View>
                <FormInput label="구매 URL" value={reviewForm.purchaseUrl} autoCapitalize="none" onChangeText={(value) => setReviewForm({ ...reviewForm, purchaseUrl: value })} />
                <FormInput label="혜택" value={reviewForm.discountInfo} onChangeText={(value) => setReviewForm({ ...reviewForm, discountInfo: value })} />
                <FormInput label="설명/메모" multiline value={reviewForm.summary} onChangeText={(value) => setReviewForm({ ...reviewForm, summary: value })} />
                <FormInput label="반려 사유 *" value={rejectReason} onChangeText={setRejectReason} />

                <View style={s.stickyActions}>
                  <SecondaryButton label="상세 저장" colors={colors} onPress={() => void saveReviewFields(selectedSubmission.id).catch((error: Error) => setFeedback(error.message))} />
                  <PrimaryButton label="승인 반영" colors={colors} onPress={() => void moderateSubmission(selectedSubmission.id, 'approve').catch((error: Error) => setFeedback(error.message))} />
                  <DangerButton label="반려" colors={colors} onPress={() => void moderateSubmission(selectedSubmission.id, 'reject').catch((error: Error) => setFeedback(error.message))} />
                </View>
              </CommerceCard>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </CommerceSurface>
  );
}

function MetricCard({
  label,
  value,
  tone,
  colors,
}: {
  label: string;
  value: string;
  tone: 'warning' | 'success' | 'error' | 'blue';
  colors: CommerceColorPalette;
}) {
  const toneColor = {
    warning: colors.warning,
    success: colors.success,
    error: colors.error,
    blue: colors.blue,
  }[tone];

  return (
    <View style={[metricStyles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <SText variant="caption" style={[metricStyles.label, { color: colors.muted }]}>{label}</SText>
      <SText variant="title" style={[metricStyles.value, { color: toneColor }]}>{value}</SText>
    </View>
  );
}

function SubmissionCard({
  item,
  selected,
  onPress,
  colors,
  styles,
}: {
  item: Submission;
  selected: boolean;
  onPress: () => void;
  colors: CommerceColorPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.submissionCard,
        selected && styles.submissionCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <SText variant="label" style={styles.itemHandle}>@{item.rawPost.influencer.instagramUsername}</SText>
          <SText variant="cardTitle" numberOfLines={2} style={styles.itemTitle}>
            {item.productName ?? '상품명 미확정'}
          </SText>
        </View>
        <StatusPill label={formatStatus(item.status)} tone={statusTone(item.status)} colors={colors} />
      </View>

      <SText variant="body" numberOfLines={2} style={styles.itemSummary}>
        {item.summary ?? item.rawPost.caption}
      </SText>

      <View style={styles.metaRow}>
        <SText variant="caption" style={styles.itemMeta}>{item.brandName ?? '브랜드 미확정'}</SText>
        <SText variant="caption" style={styles.itemMeta}>{item.endDate ? `~ ${formatDate(item.endDate)}` : '종료일 미정'}</SText>
      </View>
      <SText variant="label" style={styles.cardAction}>상세 검수 열기</SText>
    </Pressable>
  );
}

function EmptyState({ title, body, colors }: { title: string; body: string; colors: CommerceColorPalette }) {
  return (
    <View style={[emptyStyles.box, { backgroundColor: colors.panelBg, borderColor: colors.borderLight }]}>
      <SText variant="cardTitle" style={[emptyStyles.title, { color: colors.text }]}>{title}</SText>
      <SText variant="body" style={[emptyStyles.body, { color: colors.muted }]}>{body}</SText>
    </View>
  );
}

function PrimaryButton({ label, colors, onPress }: { label: string; colors: CommerceColorPalette; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [buttonStyles.primary, { backgroundColor: colors.accent }, pressed && buttonStyles.pressed]}>
      <SText variant="button" style={[buttonStyles.primaryText, { color: colors.inverse }]}>{label}</SText>
    </Pressable>
  );
}

function SecondaryButton({ label, colors, onPress }: { label: string; colors: CommerceColorPalette; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [buttonStyles.secondary, { backgroundColor: colors.softBg, borderColor: colors.border }, pressed && buttonStyles.pressed]}>
      <SText variant="label" style={[buttonStyles.secondaryText, { color: colors.text }]}>{label}</SText>
    </Pressable>
  );
}

function DangerButton({ label, colors, onPress }: { label: string; colors: CommerceColorPalette; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [buttonStyles.secondary, { backgroundColor: colors.errorSoft, borderColor: colors.error }, pressed && buttonStyles.pressed]}>
      <SText variant="label" style={[buttonStyles.secondaryText, { color: colors.error }]}>{label}</SText>
    </Pressable>
  );
}

function StatusPill({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: 'warning' | 'success' | 'error' | 'muted';
  colors: CommerceColorPalette;
}) {
  const palette = {
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
    error: { bg: colors.errorSoft, fg: colors.error },
    muted: { bg: colors.softBg, fg: colors.muted },
  }[tone];

  return (
    <View style={[pillStyles.pill, { backgroundColor: palette.bg }]}>
      <SText variant="badge" style={[pillStyles.text, { color: palette.fg }]}>{label}</SText>
    </View>
  );
}

function statusTone(status: Submission['status']) {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'error';
  return 'warning';
}

function formatStatus(status: Submission['status']) {
  const labels: Record<Submission['status'], string> = {
    APPROVED: '승인',
    REVIEW_REQUIRED: '대기',
    REJECTED: '반려',
    EXPIRED: '만료',
  };
  return labels[status];
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const metricStyles = StyleSheet.create({
  card: {
    borderRadius: commerceRadius.lg,
    borderWidth: 1,
    minHeight: 84,
    paddingHorizontal: commerceSpacing.md,
    paddingVertical: commerceSpacing.sm,
    width: '48%',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: commerceSpacing.xs,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 32,
  },
});

const buttonStyles = StyleSheet.create({
  primary: {
    alignItems: 'center',
    borderRadius: commerceRadius.lg,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: commerceSpacing.lg,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  secondary: {
    alignItems: 'center',
    borderRadius: commerceRadius.lg,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: commerceSpacing.lg,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.76,
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: commerceRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
});

const emptyStyles = StyleSheet.create({
  box: {
    borderRadius: commerceRadius.lg,
    borderWidth: 1,
    padding: commerceSpacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: commerceSpacing.xs,
  },
  body: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
});

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      paddingBottom: commerceSpacing.xxl,
      paddingHorizontal: commerceSpacing.screen,
      paddingTop: commerceSpacing.md,
    },
    header: {
      marginBottom: commerceSpacing.lg,
    },
    headerTop: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: commerceSpacing.md,
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
      marginBottom: commerceSpacing.xs,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 31,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 21,
      marginTop: commerceSpacing.xs,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: commerceSpacing.sm,
      justifyContent: 'space-between',
      marginBottom: commerceSpacing.lg,
    },
    notice: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      marginBottom: commerceSpacing.md,
      padding: commerceSpacing.md,
    },
    noticeText: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 19,
      textAlign: 'center',
    },
    tabRail: {
      gap: commerceSpacing.sm,
      paddingBottom: commerceSpacing.lg,
    },
    sectionTab: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      minHeight: 64,
      paddingHorizontal: commerceSpacing.lg,
      paddingVertical: commerceSpacing.sm,
      width: 136,
    },
    sectionTabActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    sectionTabLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
      marginBottom: commerceSpacing.xxs,
    },
    sectionTabLabelActive: {
      color: colors.accent,
    },
    sectionTabMeta: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 15,
    },
    sectionTabMetaActive: {
      color: colors.accent,
    },
    section: {
      gap: commerceSpacing.md,
      marginBottom: commerceSpacing.lg,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: commerceSpacing.xs,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 27,
    },
    sectionMeta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      marginTop: commerceSpacing.xxs,
    },
    search: {
      marginBottom: 0,
    },
    chipRail: {
      gap: commerceSpacing.sm,
      paddingRight: commerceSpacing.screen,
    },
    formPanel: {
      padding: commerceSpacing.lg,
    },
    listCard: {
      gap: commerceSpacing.md,
      padding: commerceSpacing.lg,
    },
    submissionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      gap: commerceSpacing.sm,
      padding: commerceSpacing.lg,
    },
    submissionCardSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    cardHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: commerceSpacing.md,
      justifyContent: 'space-between',
    },
    cardTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    itemHandle: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0,
      marginBottom: commerceSpacing.xxs,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 23,
    },
    itemSummary: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: commerceSpacing.sm,
    },
    itemMeta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 17,
    },
    cardAction: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0,
    },
    detailPanel: {
      gap: commerceSpacing.md,
      marginBottom: commerceSpacing.xl,
      padding: commerceSpacing.lg,
    },
    detailHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: commerceSpacing.md,
      justifyContent: 'space-between',
    },
    infoBlock: {
      backgroundColor: colors.panelBg,
      borderRadius: commerceRadius.lg,
      paddingHorizontal: commerceSpacing.md,
      paddingTop: commerceSpacing.md,
    },
    twoColumn: {
      flexDirection: 'row',
      gap: commerceSpacing.sm,
    },
    twoColumnItem: {
      flex: 1,
      minWidth: 0,
    },
    stickyActions: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      gap: commerceSpacing.sm,
      padding: commerceSpacing.sm,
    },
    pressed: {
      opacity: 0.76,
    },
  });
}
