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
import Constants from "expo-constants";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { deleteAccount } from "../api";
import { SText } from "../components/ui/SText";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useNotificationPreferences } from "../context/NotificationPreferencesContext";
import { clearLocalUserData } from "../hooks/useLocalDeals";
import {
  getNotificationPermissionStatus,
  IS_EXPO_GO,
  requestNotificationPermissions,
  scheduleTestNotification,
  type NotificationPermissionStatus,
} from "../services/notifications";
import {
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/notificationPreferences";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { RootStackParamList } from "../types";

export function SettingsScreen() {
  const { colors, spacing, radius } = useCommerceTheme();
  const { user, signOut } = useAuth();
  const {
    error: preferencesError,
    preferences,
    ready: preferencesReady,
    saving: preferencesSaving,
    toggleBrand,
    toggleInfluencer,
    updatePreferences,
  } = useNotificationPreferences();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = useMemo(
    () => makeStyles(colors, spacing, radius),
    [colors, radius, spacing],
  );
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>("undetermined");
  const [testScheduled, setTestScheduled] = useState(false);
  const automatedE2E = Constants.expoConfig?.extra?.automatedE2E === true;
  const testDelaySeconds = automatedE2E ? 8 : 10;
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getNotificationPermissionStatus()
        .then(setPermissionStatus)
        .catch(() => setPermissionStatus("error"));
    }, []),
  );

  const handlePushChange = useCallback(async (value: boolean) => {
    if (!value) {
      await updatePreferences({ pushEnabled: false });
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
      setPermissionStatus(IS_EXPO_GO ? "unsupported" : "denied");
      return;
    }
    setPermissionStatus("granted");
    await updatePreferences({ pushEnabled: true });
  }, [updatePreferences]);

  const handleDeadlineChange = useCallback(
    (value: boolean) =>
      updatePreferences({ deadlineRemindersEnabled: value }),
    [updatePreferences],
  );

  const handleNewSubmissionsChange = useCallback(
    (value: boolean) => updatePreferences({ newSubmissionsEnabled: value }),
    [updatePreferences],
  );

  const handleReminderDay = useCallback(
    async (day: NotificationReminderDay) => {
      const selected = preferences.reminderDays.includes(day);
      if (selected && preferences.reminderDays.length === 1) {
        Alert.alert(
          "알림 날짜가 필요해요",
          "마감 임박 알림을 켜려면 D-1, D-3, D-7 중 하나 이상을 선택해주세요.",
        );
        return;
      }
      await updatePreferences({
        reminderDays: selected
          ? preferences.reminderDays.filter((value) => value !== day)
          : [...preferences.reminderDays, day],
      });
    },
    [preferences.reminderDays, updatePreferences],
  );

  const handleTestNotification = useCallback(async () => {
    const id = await scheduleTestNotification(
      testDelaySeconds,
      automatedE2E ? "gon263-price-200000" : undefined,
    );
    setTestScheduled(Boolean(id));
  }, [automatedE2E, testDelaySeconds]);

  const controlsDisabled = !preferencesReady || preferencesSaving;
  const pushEnabled = preferences.pushEnabled;
  const permissionCopy = !pushEnabled
    ? "앱에서 푸시 수신을 중지했어요. 저장된 원격 토큰도 제거됩니다."
    : permissionStatus === "granted"
      ? "앱과 기기에서 푸시 알림을 받을 수 있어요."
      : permissionStatus === "unsupported"
        ? "개발 빌드에서 기기 알림 상태를 확인할 수 있어요."
        : "앱 알림은 켜져 있지만 기기 권한 확인이 필요해요.";

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
            {permissionCopy}
          </SText>
          <View style={s.switchRow}>
            <View style={s.switchCopy}>
              <SText variant="body" style={s.switchLabel}>
                푸시 알림
              </SText>
              <SText variant="caption" style={s.switchDescription}>
                원격 푸시와 기기 예약 알림 전체 제어
              </SText>
            </View>
            <Switch
              accessibilityLabel="푸시 알림"
              accessibilityHint="모든 공구 알림 수신을 켜거나 끕니다"
              disabled={controlsDisabled}
              value={pushEnabled}
              onValueChange={handlePushChange}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              thumbColor={pushEnabled ? colors.accent : colors.weak}
              testID="push-notification-toggle"
            />
          </View>
          <View style={s.switchRow}>
            <View style={s.switchCopy}>
              <SText variant="body" style={s.switchLabel}>
                공구 마감 임박 알림
              </SText>
              <SText variant="caption" style={s.switchDescription}>
                선택한 D-day에 관심 공구를 알려드려요
              </SText>
            </View>
            <Switch
              accessibilityLabel="공구 마감 임박 알림"
              disabled={controlsDisabled || !pushEnabled}
              onValueChange={(value) => void handleDeadlineChange(value)}
              thumbColor={preferences.deadlineRemindersEnabled ? colors.accent : colors.weak}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              testID="deadline-notification-toggle"
              value={preferences.deadlineRemindersEnabled}
            />
          </View>
          <View style={s.switchRow}>
            <View style={s.switchCopy}>
              <SText variant="body" style={s.switchLabel}>
                신규 제보 알림
              </SText>
              <SText variant="caption" style={s.switchDescription}>
                승인된 새 공구와 팔로우 대상 소식 수신
              </SText>
            </View>
            <Switch
              accessibilityLabel="신규 제보 알림"
              disabled={controlsDisabled || !pushEnabled}
              onValueChange={(value) => void handleNewSubmissionsChange(value)}
              thumbColor={preferences.newSubmissionsEnabled ? colors.accent : colors.weak}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              testID="new-submission-notification-toggle"
              value={preferences.newSubmissionsEnabled}
            />
          </View>

          <View style={s.preferenceBlock}>
            <SText variant="label" style={s.preferenceTitle}>
              마감 알림 날짜
            </SText>
            <SText variant="caption" style={s.switchDescription}>
              이미 알림 설정한 공구도 선택 즉시 다시 예약돼요.
            </SText>
            <View style={s.dayRow}>
              {[...NOTIFICATION_REMINDER_DAYS].reverse().map((day) => {
                const selected = preferences.reminderDays.includes(day);
                return (
                  <Pressable
                    accessibilityLabel={`D-${day} 알림`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: controlsDisabled || !pushEnabled || !preferences.deadlineRemindersEnabled }}
                    disabled={controlsDisabled || !pushEnabled || !preferences.deadlineRemindersEnabled}
                    key={day}
                    onPress={() => void handleReminderDay(day)}
                    style={({ pressed }) => [
                      s.dayChip,
                      selected && s.dayChipSelected,
                      pressed && s.pressed,
                    ]}
                    testID={`deadline-reminder-day-${day}`}
                  >
                    <SText
                      style={[s.dayChipText, selected && s.dayChipTextSelected]}
                      variant="label"
                    >
                      D-{day}
                    </SText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.preferenceBlock}>
            <SText variant="label" style={s.preferenceTitle}>
              팔로우 알림
            </SText>
            <SText variant="caption" style={s.switchDescription}>
              공구 상세에서 추가한 인플루언서와 브랜드예요. 탭하면 해제돼요.
            </SText>
            {preferences.followedInfluencers.length === 0 &&
            preferences.followedBrands.length === 0 ? (
              <SText variant="caption" style={s.emptyFollowText}>
                아직 팔로우한 알림 대상이 없어요.
              </SText>
            ) : (
              <View style={s.followChipRow}>
                {preferences.followedInfluencers.map((target) => (
                  <Pressable
                    accessibilityLabel={`@${target} 인플루언서 알림 해제`}
                    accessibilityRole="button"
                    key={`influencer:${target}`}
                    onPress={() => void toggleInfluencer(target)}
                    style={({ pressed }) => [s.followChip, pressed && s.pressed]}
                  >
                    <SText style={s.followChipText} variant="caption">@{target} ×</SText>
                  </Pressable>
                ))}
                {preferences.followedBrands.map((target) => (
                  <Pressable
                    accessibilityLabel={`${target} 브랜드 알림 해제`}
                    accessibilityRole="button"
                    key={`brand:${target}`}
                    onPress={() => void toggleBrand(target)}
                    style={({ pressed }) => [s.followChip, pressed && s.pressed]}
                  >
                    <SText style={s.followChipText} variant="caption">{target} ×</SText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {preferencesError ? (
            <SText accessibilityRole="alert" style={s.preferenceError} variant="caption">
              알림 설정을 저장하지 못했어요. 다시 변경해 주세요.
            </SText>
          ) : null}
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
              disabled={controlsDisabled || !pushEnabled || permissionStatus !== "granted"}
              onPress={() => void handleTestNotification()}
              style={({ pressed }) => [
                s.testButton,
                (controlsDisabled || !pushEnabled || permissionStatus !== "granted") && s.disabledButton,
                pressed && s.pressed,
              ]}
              testID="test-notification-button"
            >
              {testScheduled ? (
                <SText variant="label" style={s.testButtonText}>
                  {testDelaySeconds}초 뒤 알림 예약됨
                </SText>
              ) : (
                <SText variant="label" style={s.testButtonText}>
                  테스트 알림 보내기 ({testDelaySeconds}초)
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
    preferenceBlock: {
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    preferenceTitle: { color: colors.text, fontWeight: "900" },
    dayRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    dayChip: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: radius.full,
      borderWidth: 1,
      minHeight: 44,
      justifyContent: "center",
      minWidth: 72,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    dayChipSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    dayChipText: { color: colors.weak, fontWeight: "900" },
    dayChipTextSelected: { color: colors.accent },
    followChipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    followChip: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.full,
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    followChipText: { color: colors.accent, fontWeight: "900" },
    emptyFollowText: { color: colors.weak, paddingVertical: spacing.sm },
    preferenceError: {
      color: colors.error,
      fontWeight: "800",
      paddingTop: spacing.md,
    },
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
