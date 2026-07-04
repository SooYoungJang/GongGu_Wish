import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fallbackGroupBuys } from '../api';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SText } from '../components/ui/SText';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { CommerceColorPalette } from '../design/commerce';
import { spacing } from '../design/tokens';
import type { GroupBuy, RootStackParamList } from '../types';

type MenuRowProps = {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
};

function MenuRow({ icon, label, description, onPress, s }: MenuRowProps) {
  return (
    <Pressable
      accessible
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, pressed && s.pressed]}
    >
      <View style={s.menuIconBox}>
        <SText variant="body" style={s.menuIcon}>{icon}</SText>
      </View>
      <View style={s.menuCopy}>
        <SText variant="body" style={s.menuLabel}>{label}</SText>
        {description ? <SText variant="caption" style={s.menuDescription}>{description}</SText> : null}
      </View>
      <SText variant="body" style={s.menuArrow}>›</SText>
    </Pressable>
  );
}

function GuestSummaryCards({ todayCount, bookmarkCount, s }: { todayCount: number; bookmarkCount: number; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.summaryGrid}>
      <View style={s.summaryCard}>
        <SText variant="caption" style={s.summaryLabel}>오늘 본 목록</SText>
        <SText variant="cardTitle" style={s.summaryValue}>{todayCount}개</SText>
      </View>
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

function MiniDealCard({ item, onPress, s }: { item: GroupBuy; onPress: (item: GroupBuy) => void; s: ReturnType<typeof makeStyles> }) {
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
    </Pressable>
  );
}

function DealShelf({
  title,
  subtitle,
  items,
  emptyText,
  onPressDeal,
  s,
}: {
  title: string;
  subtitle: string;
  items: GroupBuy[];
  emptyText: string;
  onPressDeal: (item: GroupBuy) => void;
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
            <MiniDealCard key={`${title}-${item.id}`} item={item} onPress={onPressDeal} s={s} />
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

function NotificationSettingsPanel({
  deadlineAlertEnabled,
  recommendAlertEnabled,
  onToggleDeadline,
  onToggleRecommend,
  colors,
  s,
}: {
  deadlineAlertEnabled: boolean;
  recommendAlertEnabled: boolean;
  onToggleDeadline: (value: boolean) => void;
  onToggleRecommend: (value: boolean) => void;
  colors: CommerceColorPalette;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.notificationCard}>
      <SText variant="cardTitle" style={s.notificationTitle}>알림 설정</SText>
      <SText variant="caption" style={s.notificationSubtitle}>로그인하지 않아도 이 기기에서 바로 바꿀 수 있어요.</SText>
      <View style={s.switchRow}>
        <View style={s.switchCopy}>
          <SText variant="body" style={s.switchLabel}>마감 임박 알림</SText>
          <SText variant="caption" style={s.switchDescription}>관심 공구 마감 전에 알려드려요</SText>
        </View>
        <Switch
          value={deadlineAlertEnabled}
          onValueChange={onToggleDeadline}
          trackColor={{ false: colors.softBg, true: colors.accentSoft }}
          thumbColor={deadlineAlertEnabled ? colors.accent : colors.weak}
        />
      </View>
      <View style={[s.switchRow, s.switchRowLast]}>
        <View style={s.switchCopy}>
          <SText variant="body" style={s.switchLabel}>추천 공구 알림</SText>
          <SText variant="caption" style={s.switchDescription}>취향에 맞는 새 공구를 받을 수 있어요</SText>
        </View>
        <Switch
          value={recommendAlertEnabled}
          onValueChange={onToggleRecommend}
          trackColor={{ false: colors.softBg, true: colors.accentSoft }}
          thumbColor={recommendAlertEnabled ? colors.accent : colors.weak}
        />
      </View>
    </View>
  );
}

export function MyPageScreen() {
  const { colors } = useCommerceTheme();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deadlineAlertEnabled, setDeadlineAlertEnabled] = useState(true);
  const [recommendAlertEnabled, setRecommendAlertEnabled] = useState(false);
  const viewedToday = useMemo(() => fallbackGroupBuys.slice(0, 3), []);
  const bookmarkedDeals = useMemo(() => fallbackGroupBuys.slice(1, 4), []);

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

  const showReady = useCallback((title: string, message: string) => {
    Alert.alert(title, message);
  }, []);

  const handlePressDeal = useCallback((item: GroupBuy) => {
    navigation.navigate('Detail', { groupBuy: item });
  }, [navigation]);

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
            <SText variant="cardTitle" style={s.guestHeroTitle}>내 쇼핑 활동을 가볍게 모아봤어요</SText>
            <SText variant="caption" style={s.guestHeroSubtitle}>
              로그인하지 않아도 오늘 본 목록, 북마크, 알림 설정을 확인할 수 있어요.
            </SText>
            <Pressable accessibilityRole="button" onPress={handleLoginPress} style={({ pressed }) => [s.softLoginButton, pressed && s.pressed]}>
              <SText variant="label" style={s.softLoginText}>계정 연결해서 여러 기기에서 이어보기</SText>
            </Pressable>
          </View>
        )}

        <GuestSummaryCards todayCount={viewedToday.length} bookmarkCount={bookmarkedDeals.length} s={s} />

        <DealShelf
          title="오늘 본 목록"
          subtitle="오늘 둘러본 상품을 빠르게 이어봐요"
          items={viewedToday}
          emptyText="오늘 본 상품이 아직 없어요."
          onPressDeal={handlePressDeal}
          s={s}
        />

        <DealShelf
          title="북마크한 공구"
          subtitle={user ? '저장해둔 공구를 모아봤어요' : '이 기기에 저장된 공구를 보여줘요'}
          items={bookmarkedDeals}
          emptyText="북마크한 공구가 아직 없어요."
          onPressDeal={handlePressDeal}
          s={s}
        />

        <NotificationSettingsPanel
          deadlineAlertEnabled={deadlineAlertEnabled}
          recommendAlertEnabled={recommendAlertEnabled}
          onToggleDeadline={setDeadlineAlertEnabled}
          onToggleRecommend={setRecommendAlertEnabled}
          colors={colors}
          s={s}
        />

        <View style={s.menuGroup}>
          <MenuRow
            icon="↺"
            label="오늘 본 목록"
            description="방금 둘러본 상품과 공구를 다시 보기"
            onPress={() => showReady('오늘 본 목록', '최근 본 공구 목록을 준비 중입니다.')}
            s={s}
          />
          <MenuRow
            icon="♡"
            label="북마크한 공구"
            description={user ? '저장한 공구 모아보기' : '로그인 전에는 이 기기에만 저장돼요'}
            onPress={() => showReady('북마크한 공구', '북마크 목록 기능은 준비 중입니다.')}
            s={s}
          />
          <MenuRow
            icon="!"
            label="알림 설정"
            description="마감 임박·추천 공구 알림을 이 기기에서 관리"
            onPress={() => showReady('알림 설정', '아래 알림 설정 카드에서 바로 변경할 수 있어요.')}
            s={s}
          />
          {user ? (
            <MenuRow
              icon="↗"
              label="내 제보한 공구"
              description="직접 제보한 공구 진행 상태 확인"
              onPress={() => showReady('내 제보한 공구', '내 제보 목록 기능은 준비 중입니다.')}
              s={s}
            />
          ) : null}
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
