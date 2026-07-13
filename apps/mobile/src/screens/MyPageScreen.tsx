import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ApiError, postPublicJson } from '../api';
import { useBookmarks, useRecentViews, useNotifications, useWishItems } from '../hooks/useLocalDeals';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SText } from '../components/ui/SText';
import { useAuth } from '../context/AuthContext';
import { useCommerceTheme } from '../design/useCommerceTheme';
import { useTabReselect } from '../hooks/useTabReselect';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { spacing } from '../design/tokens';
import type { GroupBuy, MainTabParamList, RootStackParamList } from '../types';

type PublicWishSubmissionResponse = {
  alreadyRegistered?: boolean;
  submissionId?: string | null;
  submission?: {
    id?: string;
  };
  status?: string;
};

function isInstagramPostUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    if (!parsed.hostname.includes('instagram.com') && !parsed.hostname.includes('instagr.am')) {
      return false;
    }
    return /\/p\/|\/reel\/|\/tv\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

function GuestSummaryCards({
  wishItemCount,
  onPressRegisterWish,
  s,
}: {
  wishItemCount: number;
  onPressRegisterWish: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.summaryGrid}>
      <View style={s.summaryCard}>
        <SText variant="caption" style={s.summaryLabel}>내가 등록한 위시템</SText>
        <View style={s.summaryValueRow}>
          <SText variant="cardTitle" style={s.summaryValue}>{wishItemCount}개</SText>
          <Pressable
            accessibilityLabel="위시 아이템 등록하기"
            accessibilityRole="button"
            onPress={onPressRegisterWish}
            style={({ pressed }) => [s.wishRegisterButton, pressed && s.pressed]}
          >
            <SText variant="label" style={s.wishRegisterButtonText}>등록하기</SText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getDealVisual(item: GroupBuy) {
  return item.thumbnailUrl ?? item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ?? item.mediaUrls?.[0] ?? null;
}

function MiniDealCard({ item, onPress, onRemove, removeLabel, s }: { item: GroupBuy; onPress: (item: GroupBuy) => void; onRemove?: (item: GroupBuy) => void; removeLabel: string; s: ReturnType<typeof makeStyles> }) {
  const visual = getDealVisual(item);
  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 열기`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [s.miniDealCard, pressed && s.pressed]}
    >
      {visual ? (
        <Image source={{ uri: visual }} style={s.miniDealImage} />
      ) : (
        <View style={s.miniDealFallback}>
          <SText variant="caption" style={s.miniDealFallbackText}>공구</SText>
        </View>
      )}
      <SText variant="label" numberOfLines={2} style={s.miniDealTitle}>
        {item.productName ?? '공동구매 상품'}
      </SText>
      <SText variant="caption" numberOfLines={1} style={s.miniDealMeta}>
        {item.discountInfo ?? item.brandName ?? '혜택 확인'}
      </SText>
      {onRemove ? (
        <Pressable
          accessibilityLabel={`${item.productName ?? '공구'} ${removeLabel}`}
          accessibilityRole="button"
          onPress={() => onRemove(item)}
          hitSlop={8}
          style={s.miniDealRemove}
        >
          <SText variant="caption" style={s.miniDealRemoveText}>x</SText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function DealShelf({
  title,
  subtitle,
  items,
  emptyText,
  onPressDeal,
  onRemoveDeal,
  removeLabel = '삭제',
  s,
}: {
  title: string;
  subtitle: string;
  items: GroupBuy[];
  emptyText: string;
  onPressDeal: (item: GroupBuy) => void;
  onRemoveDeal?: (item: GroupBuy) => void;
  removeLabel?: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.dealShelf}>
      <View style={s.shelfHeader}>
        <View>
          <SText variant="cardTitle" style={s.shelfTitle}>{title}</SText>
          <SText variant="caption" style={s.shelfSubtitle}>{subtitle}</SText>
        </View>
      </View>
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.miniDealRail}>
          {items.map((item) => (
            <MiniDealCard key={`${title}-${item.id}`} item={item} onPress={onPressDeal} onRemove={onRemoveDeal} removeLabel={removeLabel} s={s} />
          ))}
        </ScrollView>
      ) : (
        <View style={s.emptyShelf}>
          <SText variant="caption" style={s.emptyShelfText}>{emptyText}</SText>
        </View>
      )}
    </View>
  );
}


export function MyPageScreen() {
  const { colors } = useCommerceTheme();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { bookmarks: bookmarkedDeals, removeBookmark, refresh: refreshBookmarks } = useBookmarks();
  const { recentViews: viewedToday, refresh: refreshRecent } = useRecentViews();
  const { notifications, removeNotification, refresh: refreshNotifications } = useNotifications();
  const { wishItems, recordWishItem, refresh: refreshWishItems } = useWishItems();
  const [wishModalVisible, setWishModalVisible] = useState(false);
  const [wishUrl, setWishUrl] = useState('');
  const [wishFeedback, setWishFeedback] = useState<string | null>(null);
  const [wishSubmitting, setWishSubmitting] = useState(false);

  const refreshMyPage = useCallback(() => {
    refreshBookmarks();
    refreshRecent();
    refreshNotifications();
    refreshWishItems();
  }, [refreshBookmarks, refreshRecent, refreshNotifications, refreshWishItems]);

  useFocusEffect(
    useCallback(() => {
      refreshMyPage();
    }, [refreshMyPage]),
  );

  const handleMyPageTabReselect = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    refreshMyPage();
  }, [refreshMyPage]);

  useTabReselect(tabNavigation, handleMyPageTabReselect);

  const handleLoginPress = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  }, [signOut]);

  const handlePressDeal = useCallback((item: GroupBuy) => {
    navigation.navigate('Detail', { groupBuy: item });
  }, [navigation]);

  const closeWishModal = useCallback(() => {
    if (wishSubmitting) return;
    setWishModalVisible(false);
    setWishUrl('');
    setWishFeedback(null);
  }, [wishSubmitting]);

  const handleSubmitWish = useCallback(async () => {
    const instagramUrl = wishUrl.trim();
    if (!isInstagramPostUrl(instagramUrl)) {
      setWishFeedback('인스타그램 게시물 URL을 입력해주세요.');
      return;
    }

    setWishSubmitting(true);
    setWishFeedback(null);
    try {
      const result = await postPublicJson<PublicWishSubmissionResponse>('/submissions', {
        instagramUrl,
        isAnonymous: true,
        source: 'wish-url',
      });
      const submissionId = result.submission?.id ?? result.submissionId ?? null;
      recordWishItem({
        submissionId,
        groupBuyId: null,
        instagramUrl,
        productName: '검수 대기 위시템',
        thumbnailUrl: null,
        mediaType: null,
      });
      refreshWishItems();
      setWishFeedback(result.alreadyRegistered ? '이미 등록된 위시템이에요.' : '위시템 등록 요청이 접수됐어요.');
      setWishUrl('');
    } catch (error) {
      setWishFeedback(error instanceof ApiError ? error.message : '등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setWishSubmitting(false);
    }
  }, [recordWishItem, refreshWishItems, wishUrl]);

  const notificationDeals = useMemo<GroupBuy[]>(
    () => notifications.map((entry) => ({
      id: entry.groupBuyId,
      productName: entry.productName,
      brandName: null,
      category: null,
      startDate: null,
      endDate: entry.endDate,
      purchaseUrl: null,
      discountInfo: null,
      summary: null,
      confidence: 0,
      thumbnailUrl: entry.thumbnailUrl,
      videoUrl: null,
      mediaUrls: [],
      mediaType: null,
      rawPost: { postUrl: '', influencer: { instagramUsername: '' } },
    })),
    [notifications],
  );

  if (authLoading) {
    return (
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.center}>
          <SText variant="body" style={s.loadingText}>로딩 중...</SText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <Modal
        animationType="fade"
        transparent
        visible={wishModalVisible}
        onRequestClose={closeWishModal}
      >
        <View style={s.modalBackdrop}>
          <View style={s.wishDialog}>
            <SText variant="cardTitle" style={s.wishDialogTitle}>위시 아이템 등록하기</SText>
            <SText variant="caption" style={s.wishDialogDescription}>
              인스타그램 게시물 URL만 등록하면 검수 후 위시템으로 반영돼요.
            </SText>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!wishSubmitting}
              keyboardType="url"
              onChangeText={(value) => {
                setWishUrl(value);
                setWishFeedback(null);
              }}
              placeholder="https://www.instagram.com/p/..."
              placeholderTextColor={colors.weak}
              style={s.wishInput}
              value={wishUrl}
            />
            {wishFeedback ? (
              <SText variant="caption" style={s.wishFeedback}>{wishFeedback}</SText>
            ) : null}
            <View style={s.wishDialogActions}>
              <Pressable
                accessibilityRole="button"
                disabled={wishSubmitting}
                onPress={closeWishModal}
                style={({ pressed }) => [s.wishSecondaryButton, pressed && s.pressed]}
              >
                <SText variant="label" style={s.wishSecondaryButtonText}>닫기</SText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={wishSubmitting}
                onPress={() => void handleSubmitWish()}
                style={({ pressed }) => [s.wishPrimaryButton, pressed && s.pressed, wishSubmitting && s.disabledButton]}
              >
                {wishSubmitting ? (
                  <ActivityIndicator color={colors.inverse} size="small" />
                ) : (
                  <SText variant="label" style={s.wishPrimaryButtonText}>등록</SText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView ref={scrollRef} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="마이페이지"
          right={(
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="설정 열기"
              hitSlop={8}
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [s.headerButton, pressed && s.pressed]}
            >
              <Ionicons name="menu-outline" size={24} color={colors.text} />
            </Pressable>
          )}
        />

        {user ? (
          <View style={s.profileCard}>
            <View style={s.avatarCircle}>
              <SText variant="title" style={s.avatarText}>{(user.email ?? '?')[0].toUpperCase()}</SText>
            </View>
            <SText variant="cardTitle" style={s.profileEmail}>{user.email}</SText>
            <SText variant="caption" style={s.profileJoined}>
              가입일: {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '알 수 없음'}
            </SText>
          </View>
        ) : (
          <View style={s.guestHero}>
            <SText variant="cardTitle" style={s.guestHeroTitle}>내 활동을 가볍게 모아봤어요</SText>
            <SText variant="caption" style={s.guestHeroSubtitle}>
              로그인하지 않아도 최근 본 공구, 북마크, 알림 설정을 확인할 수 있어요.
            </SText>
            <Pressable accessibilityRole="button" onPress={handleLoginPress} style={({ pressed }) => [s.softLoginButton, pressed && s.pressed]}>
              <SText variant="label" style={s.softLoginText}>계정 연결해서 여러 기기에서 이어보기</SText>
            </Pressable>
          </View>
        )}

        <GuestSummaryCards
          wishItemCount={wishItems.length}
          onPressRegisterWish={() => setWishModalVisible(true)}
          s={s}
        />

        <DealShelf
          title="최근 본 공구"
          subtitle="최근 10개까지 모아봤어요"
          items={viewedToday}
          emptyText="최근 본 공구가 아직 없어요."
          onPressDeal={handlePressDeal}
          s={s}
        />

        <DealShelf
          title="북마크한 공구"
          subtitle={user ? '저장해둔 공구를 모아봤어요' : '이 기기에 저장된 공구예요'}
          items={bookmarkedDeals}
          emptyText="북마크한 공구가 아직 없어요."
          onPressDeal={handlePressDeal}
          onRemoveDeal={(item) => removeBookmark(item.id)}
          removeLabel="북마크 해제"
          s={s}
        />

        <DealShelf
          title="알림 설정한 공구"
          subtitle="시작 알림을 설정한 공구예요"
          items={notificationDeals}
          emptyText="알림을 설정한 공구가 아직 없어요."
          onPressDeal={handlePressDeal}
          onRemoveDeal={(item) => removeNotification(item.id)}
          removeLabel="알림 해제"
          s={s}
        />

        {user ? (
          <View style={s.logoutSection}>
            <AppButton variant="secondary" onPress={handleLogout} disabled={loggingOut}>
              {loggingOut ? '로그아웃 중...' : '로그아웃'}
            </AppButton>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.muted,
    },
    scrollContent: {
      paddingBottom: 122,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    headerButton: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    profileCard: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      marginBottom: spacing.lg,
      padding: spacing['2xl'],
    },
    avatarCircle: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 40,
      height: 80,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 80,
    },
    avatarText: {
      color: colors.accent,
      fontSize: 32,
      fontWeight: '900',
    },
    profileEmail: {
      color: colors.text,
      fontWeight: '900',
      marginBottom: spacing.xs,
    },
    profileJoined: {
      color: colors.weak,
      marginBottom: 0,
    },
    guestHero: {
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing['2xl'],
    },
    guestHeroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 27,
      marginBottom: spacing.sm,
    },
    guestHeroSubtitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    softLoginButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    softLoginText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    summaryGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      minHeight: 86,
      padding: spacing.lg,
    },
    summaryLabel: {
      color: colors.weak,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    summaryValueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    wishRegisterButton: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    wishRegisterButtonText: {
      color: colors.inverse,
      fontSize: 12,
      fontWeight: '900',
    },
    modalBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    wishDialog: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 20,
      borderWidth: 1,
      padding: spacing.xl,
      width: '100%',
    },
    wishDialogTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: spacing.sm,
    },
    wishDialogDescription: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginBottom: spacing.lg,
    },
    wishInput: {
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    wishFeedback: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 17,
      marginTop: spacing.sm,
    },
    wishDialogActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
    },
    wishSecondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 76,
      paddingHorizontal: spacing.lg,
    },
    wishSecondaryButtonText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '900',
    },
    wishPrimaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 999,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 76,
      paddingHorizontal: spacing.lg,
    },
    wishPrimaryButtonText: {
      color: colors.inverse,
      fontSize: 13,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.7,
    },
    dealShelf: {
      marginBottom: spacing.lg,
    },
    shelfHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    shelfTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 24,
    },
    shelfSubtitle: {
      color: colors.weak,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 2,
    },
    miniDealRail: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
    },
    miniDealCard: {
      width: 132,
    },
    miniDealImage: {
      backgroundColor: colors.softBg,
      borderRadius: 18,
      height: 132,
      marginBottom: spacing.sm,
      width: 132,
    },
    miniDealFallback: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 132,
      justifyContent: 'center',
      marginBottom: spacing.sm,
      width: 132,
    },
    miniDealFallbackText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '900',
    },
    miniDealTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      lineHeight: 18,
    },
    miniDealMeta: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 16,
      marginTop: 2,
    },
    miniDealRemove: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      position: 'absolute',
      right: 6,
      top: 6,
      width: 20,
    },
    miniDealRemoveText: {
      color: colors.weak,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
    },
    emptyShelf: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      minHeight: 84,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyShelfText: {
      color: colors.weak,
      fontWeight: '700',
    },
    menuGroup: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    menuRow: {
      alignItems: 'center',
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 72,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    pressed: {
      opacity: 0.65,
    },
    menuIconBox: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: 14,
      height: 42,
      justifyContent: 'center',
      marginRight: spacing.md,
      width: 42,
    },
    menuIcon: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
      textAlign: 'center',
    },
    menuCopy: {
      flex: 1,
    },
    menuLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 20,
    },
    menuDescription: {
      color: colors.weak,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 3,
    },
    menuArrow: {
      color: colors.weak,
      fontSize: 24,
      fontWeight: '500',
      lineHeight: 28,
      marginLeft: spacing.sm,
    },
    logoutSection: {
      marginTop: spacing.sm,
    },
  });
}
