import { useCallback, useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SText } from '../components/ui/SText';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing } from '../design/tokens';
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
    <View style={s.container}>
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
    </View>
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
          eyebrow="MY"
          title="마이페이지"
          subtitle="내 계정 정보를 확인하고 관리하세요."
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

function UnauthenticatedView({
  onLoginPress,
  colors,
}: {
  onLoginPress: () => void;
  colors: ColorPalette;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="MY"
          title="마이페이지"
          subtitle="로그인하고 내 정보를 확인하세요."
        />

        <View style={s.loginPrompt}>
          <SText variant="body" style={s.loginPromptText}>
            로그인이 필요합니다.
          </SText>
          <AppButton variant="primary" onPress={onLoginPress}>
            로그인
          </AppButton>
        </View>
      </ScrollView>
    </View>
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
      padding: spacing['2xl'],
      paddingTop: spacing['3xl'],
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
    logoutSection: {
      marginTop: spacing.sm,
    },
    loginPrompt: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing['3xl'],
    },
    loginPromptText: {
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
  });
}
