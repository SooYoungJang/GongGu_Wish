import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { deleteAccount } from "../api";
import { useAds } from "../ads/AdsContext";
import { SText } from "../components/ui/SText";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useNotificationPreferences } from "../context/NotificationPreferencesContext";
import { clearLocalUserData } from "../hooks/useLocalDeals";
import { useAuthGate } from "../hooks/useAuthGate";
import {
  DEFAULT_PRIVACY_POLICY_URL,
  DEFAULT_TERMS_OF_SERVICE_URL,
  resolveAppInfo,
} from "../lib/app-info";
import { isAutomatedE2E } from "../lib/automatedE2E";
import {
  getNotificationPermissionStatus,
  IS_EXPO_GO,
  registerForPushNotifications,
  scheduleTestNotification,
  type NotificationPermissionStatus,
} from "../services/notifications";
import {
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/notificationPreferences";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { RootStackParamList } from "../types";
import bundledAppConfig from "../../app.json";

const APP_INFO = resolveAppInfo({
  nativeApplicationVersion: Application.nativeApplicationVersion,
  nativeBuildVersion: Application.nativeBuildVersion,
  configuredVersion: Constants.expoConfig?.version,
  fallbackVersion: bundledAppConfig.expo.version,
  privacyPolicyUrl:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() ||
    DEFAULT_PRIVACY_POLICY_URL,
  termsOfServiceUrl:
    process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL?.trim() ||
    DEFAULT_TERMS_OF_SERVICE_URL,
});

export function SettingsScreen() {
  const { colors, spacing, radius } = useCommerceTheme();
  const { privacyOptionsRequired, showPrivacyOptions } = useAds();
  const { user, session, signOut } = useAuth();
  const accessToken = session?.access_token;
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
  const { isAuthenticated, requireAuth } = useAuthGate();
  const s = useMemo(
    () => makeStyles(colors, spacing, radius),
    [colors, radius, spacing],
  );
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>("undetermined");
  const [testScheduled, setTestScheduled] = useState(false);
  const automatedE2E = isAutomatedE2E();
  const testDelaySeconds = automatedE2E ? 8 : 10;
  const [deleting, setDeleting] = useState(false);
  const [updatingAdPrivacy, setUpdatingAdPrivacy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getNotificationPermissionStatus()
        .then(setPermissionStatus)
        .catch(() => setPermissionStatus("error"));
    }, []),
  );

  const handlePushChange = useCallback(
    async (value: boolean) => {
      if (!requireAuth()) return;
      if (!value) {
        await updatePreferences({ pushEnabled: false });
        return;
      }

      if (!accessToken) {
        Alert.alert(
          "로그인 정보를 확인해 주세요",
          "다시 로그인한 뒤 푸시 알림을 켜주세요.",
        );
        return;
      }

      const result = await registerForPushNotifications(accessToken, {
        requestPermission: true,
        ...(automatedE2E
          ? { e2eTokenOverride: "ExpoPushToken[gon229-local-e2e]" }
          : {}),
      });
      if (result.status === "registered") {
        setPermissionStatus("granted");
        await updatePreferences({ pushEnabled: true });
        return;
      }

      if (result.status === "unsupported") {
        setPermissionStatus("unsupported");
        Alert.alert(
          "알림을 켤 수 없어요",
          result.reason === "expo-go" || IS_EXPO_GO
            ? "Expo Go에서는 푸시 알림이 지원되지 않아요. 개발 빌드에서 이용 가능합니다."
            : "이 앱에는 알림 기능이 포함되지 않았어요. 최신 앱을 다시 설치해 주세요.",
        );
        return;
      }

      if (result.status === "unavailable") {
        setPermissionStatus(
          result.reason === "permission-denied" ? "denied" : "error",
        );
        Alert.alert(
          "알림을 켤 수 없어요",
          result.reason === "permission-denied"
            ? "기기 설정에서 알림 권한을 허용해 주세요."
            : "기기 알림 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      const failureMessage =
        result.reason === "backend-registration-failed"
          ? "네트워크 연결을 확인한 뒤 푸시 알림을 다시 켜주세요."
          : result.reason === "missing-project-id"
            ? "앱 설정에 푸시 정보가 빠져 있어요. 최신 앱을 다시 설치해 주세요."
            : "앱 설정 또는 기기의 푸시 연결을 확인한 뒤 최신 앱에서 다시 시도해 주세요.";
      if (result.status === "failed") {
        Alert.alert("푸시 알림 등록에 실패했어요", failureMessage);
      }
    },
    [accessToken, automatedE2E, requireAuth, updatePreferences],
  );

  const handleDeadlineChange = useCallback(
    (value: boolean) => {
      if (!requireAuth()) return;
      void updatePreferences({ deadlineRemindersEnabled: value });
    },
    [requireAuth, updatePreferences],
  );

  const handleNewSubmissionsChange = useCallback(
    (value: boolean) => {
      if (!requireAuth()) return;
      void updatePreferences({ newSubmissionsEnabled: value });
    },
    [requireAuth, updatePreferences],
  );

  const handleReminderDay = useCallback(
    async (day: NotificationReminderDay) => {
      if (!requireAuth()) return;
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
    [preferences.reminderDays, requireAuth, updatePreferences],
  );

  const handleFollowInfluencerPress = useCallback(
    (target: string) => {
      if (!requireAuth()) return;
      void toggleInfluencer(target);
    },
    [requireAuth, toggleInfluencer],
  );

  const handleFollowBrandPress = useCallback(
    (target: string) => {
      if (!requireAuth()) return;
      void toggleBrand(target);
    },
    [requireAuth, toggleBrand],
  );

  const handleTestNotification = useCallback(async () => {
    const id = await scheduleTestNotification(
      testDelaySeconds,
      automatedE2E ? "gon263-e2e-price-200000" : undefined,
    );
    setTestScheduled(Boolean(id));
  }, [automatedE2E, testDelaySeconds]);

  const controlsDisabled = !preferencesReady || preferencesSaving;
  const pushEnabled = isAuthenticated && preferences.pushEnabled;
  const deadlineRemindersEnabled =
    isAuthenticated && preferences.deadlineRemindersEnabled;
  const newSubmissionsEnabled =
    isAuthenticated && preferences.newSubmissionsEnabled;
  const permissionCopy = !isAuthenticated
    ? "로그인 후 원하는 알림을 직접 켤 수 있어요."
    : !pushEnabled
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

  const handleAdPrivacyOptions = useCallback(async () => {
    if (updatingAdPrivacy) return;
    setUpdatingAdPrivacy(true);
    try {
      const shown = await showPrivacyOptions();
      if (!shown) {
        Alert.alert(
          "개인정보 설정을 열지 못했어요",
          "잠시 후 다시 시도해주세요.",
        );
      }
    } finally {
      setUpdatingAdPrivacy(false);
    }
  }, [showPrivacyOptions, updatingAdPrivacy]);

  const handleOpenLegalDocument = useCallback(
    async (title: string, url: string | null) => {
      if (!url) {
        Alert.alert(
          `${title}을 준비 중이에요`,
          "공식 문서가 게시되면 이 버튼에서 바로 확인할 수 있어요.",
        );
        return;
      }

      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          `${title}을 열지 못했어요`,
          "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
        );
      }
    },
    [],
  );

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.scrollContent}
      >
        <SText variant="subtitle" style={s.intro}>
          알림과 화면 테마, 앱 정보를 편하게 확인해보세요.
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
              disabled={controlsDisabled || (isAuthenticated && !pushEnabled)}
              onValueChange={(value) => void handleDeadlineChange(value)}
              thumbColor={
                deadlineRemindersEnabled ? colors.accent : colors.weak
              }
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              testID="deadline-notification-toggle"
              value={deadlineRemindersEnabled}
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
              disabled={controlsDisabled || (isAuthenticated && !pushEnabled)}
              onValueChange={(value) => void handleNewSubmissionsChange(value)}
              thumbColor={newSubmissionsEnabled ? colors.accent : colors.weak}
              trackColor={{ false: colors.softBg, true: colors.accentSoft }}
              testID="new-submission-notification-toggle"
              value={newSubmissionsEnabled}
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
                const selected =
                  isAuthenticated && preferences.reminderDays.includes(day);
                const dayDisabled =
                  controlsDisabled ||
                  (isAuthenticated &&
                    (!pushEnabled || !deadlineRemindersEnabled));
                return (
                  <Pressable
                    accessibilityLabel={`D-${day} 알림`}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: selected,
                      disabled: dayDisabled,
                    }}
                    disabled={dayDisabled}
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
                    onPress={() => handleFollowInfluencerPress(target)}
                    style={({ pressed }) => [
                      s.followChip,
                      pressed && s.pressed,
                    ]}
                  >
                    <SText style={s.followChipText} variant="caption">
                      @{target} ×
                    </SText>
                  </Pressable>
                ))}
                {preferences.followedBrands.map((target) => (
                  <Pressable
                    accessibilityLabel={`${target} 브랜드 알림 해제`}
                    accessibilityRole="button"
                    key={`brand:${target}`}
                    onPress={() => handleFollowBrandPress(target)}
                    style={({ pressed }) => [
                      s.followChip,
                      pressed && s.pressed,
                    ]}
                  >
                    <SText style={s.followChipText} variant="caption">
                      {target} ×
                    </SText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {preferencesError ? (
            <SText
              accessibilityRole="alert"
              style={s.preferenceError}
              variant="caption"
            >
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
              disabled={
                controlsDisabled ||
                !pushEnabled ||
                permissionStatus !== "granted"
              }
              onPress={() => void handleTestNotification()}
              style={({ pressed }) => [
                s.testButton,
                (controlsDisabled ||
                  !pushEnabled ||
                  permissionStatus !== "granted") &&
                  s.disabledButton,
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

        <View style={s.accountCard}>
          <SText variant="cardTitle" style={s.sectionTitle}>
            앱 정보
          </SText>
          <View style={s.infoList}>
            <Pressable
              accessibilityHint="개인정보 처리방침 문서를 엽니다"
              accessibilityLabel="개인정보 처리방침"
              accessibilityRole="button"
              onPress={() =>
                void handleOpenLegalDocument(
                  "개인정보 처리방침",
                  APP_INFO.privacyPolicyUrl,
                )
              }
              style={({ pressed }) => [s.infoRow, pressed && s.pressed]}
            >
              <View style={s.infoRowLeading}>
                <View style={s.infoIcon}>
                  <Ionicons
                    color={colors.accent}
                    name="shield-checkmark-outline"
                    size={20}
                  />
                </View>
                <SText style={s.infoRowLabel} variant="body">
                  개인정보 처리방침
                </SText>
              </View>
              <Ionicons
                color={colors.weak}
                name="chevron-forward"
                size={20}
              />
            </Pressable>

            <Pressable
              accessibilityHint="서비스 이용약관 문서를 엽니다"
              accessibilityLabel="서비스 이용약관"
              accessibilityRole="button"
              onPress={() =>
                void handleOpenLegalDocument(
                  "서비스 이용약관",
                  APP_INFO.termsOfServiceUrl,
                )
              }
              style={({ pressed }) => [s.infoRow, pressed && s.pressed]}
            >
              <View style={s.infoRowLeading}>
                <View style={s.infoIcon}>
                  <Ionicons
                    color={colors.accent}
                    name="document-text-outline"
                    size={20}
                  />
                </View>
                <SText style={s.infoRowLabel} variant="body">
                  서비스 이용약관
                </SText>
              </View>
              <Ionicons
                color={colors.weak}
                name="chevron-forward"
                size={20}
              />
            </Pressable>

            <View
              accessibilityLabel={`앱 버전 ${APP_INFO.version}`}
              accessible
              style={[s.infoRow, s.infoRowLast]}
            >
              <View style={s.infoRowLeading}>
                <View style={s.infoIcon}>
                  <Ionicons
                    color={colors.accent}
                    name="information-circle-outline"
                    size={20}
                  />
                </View>
                <SText style={s.infoRowLabel} variant="body">
                  앱 버전
                </SText>
              </View>
              <SText style={s.infoRowValue} variant="caption">
                {APP_INFO.version}
              </SText>
            </View>
          </View>
        </View>

        {privacyOptionsRequired ? (
          <View style={s.accountCard}>
            <SText variant="cardTitle" style={s.sectionTitle}>
              개인정보 및 광고
            </SText>
            <SText variant="caption" style={s.sectionSubtitle}>
              Google 광고에 사용하는 개인정보 선택을 언제든 변경할 수 있어요.
            </SText>
            <Pressable
              accessibilityLabel="광고 개인정보 설정"
              accessibilityRole="button"
              accessibilityState={{ busy: updatingAdPrivacy }}
              disabled={updatingAdPrivacy}
              onPress={handleAdPrivacyOptions}
              style={({ pressed }) => [
                s.privacyButton,
                updatingAdPrivacy && s.disabledButton,
                pressed && s.pressed,
              ]}
            >
              {updatingAdPrivacy ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <SText variant="label" style={s.privacyButtonText}>
                  광고 개인정보 설정
                </SText>
              )}
            </Pressable>
          </View>
        ) : null}

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
    infoList: { marginTop: spacing.sm },
    infoRow: {
      alignItems: "center",
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 56,
      paddingVertical: spacing.sm,
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoRowLeading: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.md,
      paddingRight: spacing.md,
    },
    infoIcon: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    infoRowLabel: { color: colors.text, fontWeight: "800" },
    infoRowValue: { color: colors.weak, fontWeight: "800" },
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
    privacyButton: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      justifyContent: "center",
      marginTop: spacing.lg,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    privacyButtonText: { color: colors.accent, fontWeight: "900" },
    disabledButton: { opacity: 0.55 },
    pressed: { opacity: 0.65 },
  });
}
