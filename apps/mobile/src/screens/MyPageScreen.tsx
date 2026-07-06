import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBookmarks, useRecentViews, useNotifications } from '../hooks/useLocalDeals';
import { requestNotificationPermissions } from '../services/notifications';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SText } from '../components/ui/SText';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { CommerceColorPalette } from '../design/commerce';
import { spacing } from '../design/tokens';
import type { GroupBuy, RootStackParamList } from '../types';

function GuestSummaryCards({ bookmarkCount, s }: { bookmarkCount: number; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.summaryGrid}>
      <View style={s.summaryCard}>
        <SText variant="caption" style={s.summaryLabel}>북마크한 공구</SText>
        <SText variant="cardTitle" style={s.summaryValue}>{bookmarkCount}개</SText>
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
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);
  const { bookmarks: bookmarkedDeals, removeBookmark, refresh: refreshBookmarks } = useBookmarks();
  const { recentViews: viewedToday, refresh: refreshRecent } = useRecentViews();
  const { notifications, removeNotification, refresh: refreshNotifications } = useNotifications();
  const [pushEnabled, setPushEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshBookmarks();
      refreshRecent();
      refreshNotifications();
      requestNotificationPermissions().then(setPushEnabled).catch(() => setPushEnabled(false));
    }, [refreshBookmarks, refreshRecent, refreshNotifications]),
  );

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
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="마이페이지" />

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

        <GuestSummaryCards bookmarkCount={bookmarkedDeals.length} s={s} />

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

        <View style={s.notificationCard}>
          <SText variant="cardTitle" style={s.notificationTitle}>알림 설정</SText>
          <SText variant="caption" style={s.notificationSubtitle}>
            {pushEnabled ? '푸시 알림이 활성화되어 있어요.' : '푸시 알림 권한이 꺼져 있어요. 기기 설정에서 켜주세요.'}
          </SText>
          <View style={s.switchRow}>
            <View style={s.switchCopy}>
              <SText variant="body" style={s.switchLabel}>푸시 알림</SText>
              <SText variant="caption" style={s.switchDescription}>공구 시작 전 알림 수신</SText>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={async (value) => {
                if (value) {
                  const granted = await requestNotificationPermissions();
                  setPushEnabled(granted);
                } else {
                  setPushEnabled(false);
                }
              }}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              thumbColor={pushEnabled ? colors.accent : colors.weak}
            />
          </View>
        </View>

        <View style={s.settingsCard}>
          <ThemeToggle />
        </View>

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
    notificationCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    notificationTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 24,
    },
    notificationSubtitle: {
      color: colors.weak,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    switchRow: {
      alignItems: 'center',
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 70,
      paddingVertical: spacing.sm,
    },
    switchRowLast: {
      borderBottomWidth: 0,
    },
    switchCopy: {
      flex: 1,
      paddingRight: spacing.md,
    },
    switchLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 20,
    },
    switchDescription: {
      color: colors.weak,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 3,
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
    settingsCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    logoutSection: {
      marginTop: spacing.sm,
    },
  });
}
