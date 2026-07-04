import { useCallback, useState, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SText } from '../components/ui/SText';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { RootStackParamList } from '../types';

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function MyPageScreen() {
  const { colors } = useTheme();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleLoginPress = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {authLoading ? (
        <View style={[s.center, { backgroundColor: colors.bg }]}>
          <SText variant="body">로딩 중...</SText>
        </View>
      ) : user ? (
        <ProfileView
          user={user}
          onLogout={signOut}
          colors={colors}
        />
      ) : (
        <UnauthenticatedView
          onLoginPress={handleLoginPress}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Profile View (Logged In) ────────────────────────────────────────────────

function ProfileView({
  user,
  onLogout,
  colors,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => Promise<void>;
  colors: ColorPalette;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout]);

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
       <ScreenHeader
          title="마이페이지"
        />

        <View style={s.profileCard}>
          <View style={s.avatarCircle}>
            <SText variant="title" style={s.avatarText}>
              {(user.email ?? '?')[0].toUpperCase()}
            </SText>
          </View>
          <SText variant="cardTitle" style={s.profileEmail}>
            {user.email}
          </SText>
          <SText variant="caption" style={s.profileJoined}>
            가입일:{' '}
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString('ko-KR')
              : '알 수 없음'}
          </SText>
        </View>

        <View style={s.menuGroup}>
          <MenuRow icon="📋" label="내 제보한 공구" onPress={() => Alert.alert('준비 중', '내 제보 목록 기능은 준비 중입니다.')} />
          <MenuRow icon="⌑" label="북마크한 공구" onPress={() => Alert.alert('준비 중', '북마크 기능은 준비 중입니다.')} />
          <MenuRow icon="👥" label="팔로우한 인플루언서" onPress={() => Alert.alert('준비 중', '팔로우 기능은 준비 중입니다.')} />
          <MenuRow icon="🔔" label="알림 설정" onPress={() => Alert.alert('준비 중', '알림 설정 기능은 준비 중입니다.')} />
        </View>

        <View style={s.logoutSection}>
          <AppButton
            variant="secondary"
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </AppButton>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Unauthenticated View ────────────────────────────────────────────────────

function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, pressed && s.menuRowPressed]}
    >
      <SText variant="body" style={s.menuIcon}>{icon}</SText>
      <SText variant="body" style={s.menuLabel}>{label}</SText>
      <SText variant="body" style={s.menuArrow}>›</SText>
    </Pressable>
  );
}

function UnauthenticatedView({
  onLoginPress,
  colors,
}: {
  onLoginPress: () => void;
  colors: ColorPalette;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleLockedMenuPress = useCallback(() => {
    onLoginPress();
  }, [onLoginPress]);

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="마이페이지"
        />

        {/* Hero value-proposition card */}
        <View style={s.guestHero}>
          <View style={s.guestHeroIconCircle}>
            <SText variant="title" style={s.guestHeroIcon}>↗</SText>
          </View>
          <SText variant="cardTitle" style={s.guestHeroTitle}>
            더 많은 공구를 만나보세요
          </SText>
          <SText variant="caption" style={s.guestHeroSubtitle}>
            로그인하면 제보, 북마크, 팔로우, 알림까지{'\n'}모든 기능을 이용할 수 있어요
          </SText>
          <AppButton variant="primary" onPress={onLoginPress} style={s.guestHeroButton}>
            로그인하기
          </AppButton>
        </View>

        {/* Locked feature preview menu */}
        <SText variant="caption" style={s.guestMenuLabel}>
          로그인하면 사용할 수 있어요
        </SText>
        <View style={s.menuGroup}>
          <LockedMenuRow icon="📋" label="내 제보한 공구" onPress={handleLockedMenuPress} />
          <LockedMenuRow icon="⌑" label="북마크한 공구" onPress={handleLockedMenuPress} />
          <LockedMenuRow icon="👥" label="팔로우한 인플루언서" onPress={handleLockedMenuPress} />
          <LockedMenuRow icon="🔔" label="알림 설정" onPress={handleLockedMenuPress} />
        </View>
      </ScrollView>
    </View>
  );
}

function LockedMenuRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, pressed && s.menuRowPressed]}
    >
      <SText variant="body" style={s.menuIcon}>{icon}</SText>
      <SText variant="body" style={[s.menuLabel, s.lockedMenuLabel]}>{label}</SText>
      <SText variant="caption" style={s.lockIcon}>🔒</SText>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing['2xl'],
    },
    profileCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: spacing['2xl'],
      padding: spacing['2xl'],
    },
    avatarCircle: {
      alignItems: 'center',
      backgroundColor: colors.primaryBg,
      borderRadius: 40,
      height: 80,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 80,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '700',
    },
    profileEmail: {
      marginBottom: spacing.xs,
    },
    profileJoined: {
      marginBottom: 0,
    },
    menuGroup: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing['2xl'],
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    menuRowPressed: {
      opacity: 0.6,
    },
    menuIcon: {
      fontSize: 18,
      marginRight: spacing.md,
      width: 24,
      textAlign: 'center',
    },
    menuLabel: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    menuArrow: {
      fontSize: 20,
      color: colors.textTertiary,
    },
    logoutSection: {
      marginTop: spacing.sm,
    },
    guestHero: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: spacing['2xl'],
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing['3xl'],
    },
    guestHeroIconCircle: {
      alignItems: 'center',
      backgroundColor: colors.primaryBg,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 72,
    },
    guestHeroIcon: {
      color: colors.primary,
      fontSize: 30,
      fontWeight: '700',
    },
    guestHeroTitle: {
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    guestHeroSubtitle: {
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
    guestHeroButton: {
      minWidth: 200,
    },
    guestMenuLabel: {
      color: colors.textTertiary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      textTransform: 'uppercase',
    },
    lockedMenuLabel: {
      color: colors.textTertiary,
    },
    lockIcon: {
      fontSize: 14,
      marginLeft: spacing.sm,
    },
  });
}
