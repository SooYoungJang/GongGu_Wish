import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { deleteAccount } from "../api";
import { SText } from "../components/ui/SText";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { clearLocalUserData } from "../hooks/useLocalDeals";
import {
  IS_EXPO_GO,
  requestNotificationPermissions,
  scheduleTestNotification,
} from "../services/notifications";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { RootStackParamList } from "../types";

export function SettingsScreen() {
  const { colors, spacing, radius } = useCommerceTheme();
  const { user, signOut } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = useMemo(
    () => makeStyles(colors, spacing, radius),
    [colors, radius, spacing],
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [testScheduled, setTestScheduled] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      requestNotificationPermissions()
        .then(setPushEnabled)
        .catch(() => setPushEnabled(false));
    }, []),
  );

  const handlePushChange = useCallback(async (value: boolean) => {
    if (!value) {
      setPushEnabled(false);
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert(
        "알림을 켤 수 없어요",
        IS_EXPO_GO
          ? "Expo Go에서는 푸시 알림이 지원되지 않아요. 개발 빌드에서 이용 가능합니다."
          : "기기 설정에서 알림 권한을 허용해 주세요.",
      );
    }
    setPushEnabled(granted);
  }, []);

  const handleTestNotification = useCallback(async () => {
    setTestScheduled(true);
    await scheduleTestNotification(10);
  }, []);

  const performAccountDeletion = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await clearLocalUserData(user?.id ? `user:${user.id}` : "guest");
      await signOut();
      navigation.goBack();
    } catch {
      Alert.alert(
        "회원탈퇴에 실패했어요",
        "잠시 후 다시 시도해주세요. 계정은 삭제되지 않았을 수 있어요.",
      );
    } finally {
      setDeleting(false);
    }
  }, [navigation, signOut, user]);

  const handleDeleteAccount = useCallback(() => {
    if (!user || deleting) return;

    Alert.alert(
      "회원탈퇴",
      "계정과 저장된 활동 데이터가 삭제되며 복구할 수 없어요. 정말 탈퇴할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "회원탈퇴",
          style: "destructive",
          onPress: () => void performAccountDeletion(),
        },
      ],
    );
  }, [deleting, performAccountDeletion, user]);

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.scrollContent}
      >
        <SText variant="subtitle" style={s.intro}>
          알림과 화면 테마를 편하게 설정해보세요.
        </SText>

        <View style={s.sectionCard}>
          <SText variant="cardTitle" style={s.sectionTitle}>
            알림 설정
          </SText>
          <SText variant="caption" style={s.sectionSubtitle}>
            {pushEnabled
              ? "푸시 알림이 활성화되어 있어요."
              : "푸시 알림 권한이 꺼져 있어요. 기기 설정에서 켜주세요."}
          </SText>
          <View style={s.switchRow}>
            <View style={s.switchCopy}>
              <SText variant="body" style={s.switchLabel}>
                푸시 알림
              </SText>
              <SText variant="caption" style={s.switchDescription}>
                공구 시작 전 알림 수신
              </SText>
            </View>
            <Switch
              accessibilityLabel="푸시 알림"
              value={pushEnabled}
              onValueChange={handlePushChange}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              thumbColor={pushEnabled ? colors.accent : colors.weak}
            />
          </View>
          {IS_EXPO_GO ? (
            <View style={s.testButton}>
              <SText variant="label" style={s.testButtonText}>
                개발 빌드에서만 테스트 가능해요
              </SText>
            </View>
          ) : (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="테스트 알림 보내기"
              onPress={() => void handleTestNotification()}
              style={({ pressed }) => [s.testButton, pressed && s.pressed]}
            >
              {testScheduled ? (
                <SText variant="label" style={s.testButtonText}>
                  10초 뒤 알림 예약됨
                </SText>
              ) : (
                <SText variant="label" style={s.testButtonText}>
                  테스트 알림 보내기 (10초)
                </SText>
              )}
            </Pressable>
          )}
        </View>

        <View style={s.sectionCard}>
          <SText variant="cardTitle" style={s.sectionTitle}>
            화면 테마
          </SText>
          <SText variant="caption" style={s.sectionSubtitle}>
            기기 설정을 따르거나 원하는 테마를 선택해요.
          </SText>
          <ThemeToggle />
        </View>

        {user ? (
          <View style={s.accountCard}>
            <SText variant="cardTitle" style={s.sectionTitle}>
              계정
            </SText>
            <SText variant="caption" style={s.sectionSubtitle}>
              회원탈퇴를 하면 계정과 저장된 활동 데이터가 모두 삭제돼요.
            </SText>
            <Pressable
              accessibilityLabel="회원탈퇴"
              accessibilityRole="button"
              disabled={deleting}
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                s.deleteButton,
                pressed && s.pressed,
                deleting && s.disabledButton,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <SText variant="label" style={s.deleteButtonText}>
                  회원탈퇴
                </SText>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(
  colors: ReturnType<typeof useCommerceTheme>["colors"],
  spacing: ReturnType<typeof useCommerceTheme>["spacing"],
  radius: ReturnType<typeof useCommerceTheme>["radius"],
) {
  return StyleSheet.create({
    container: { backgroundColor: colors.bg, flex: 1 },
    scrollContent: { gap: spacing.lg, padding: spacing.screen },
    intro: { color: colors.muted, marginBottom: spacing.xs },
    sectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sectionTitle: { color: colors.text },
    sectionSubtitle: { color: colors.weak, marginTop: spacing.xs },
    accountCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
    },
    switchRow: {
      alignItems: "center",
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: spacing.xxl * 3,
      paddingVertical: spacing.sm,
    },
    switchCopy: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
    switchLabel: { color: colors.text, fontWeight: "900" },
    switchDescription: { color: colors.weak, fontWeight: "700" },
    testButton: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      marginVertical: spacing.md,
      paddingVertical: spacing.md,
    },
    testButtonText: { color: colors.accent, fontWeight: "900" },
    deleteButton: {
      alignItems: "center",
      backgroundColor: colors.errorSoft,
      borderColor: colors.error,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.lg,
      minHeight: spacing.xxl * 2,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    deleteButtonText: { color: colors.error, fontWeight: "900" },
    disabledButton: { opacity: 0.55 },
    pressed: { opacity: 0.65 },
  });
}
