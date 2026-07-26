import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SText } from "../components/ui/SText";
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from "../design/commerce";
import { useCommerceTheme } from "../design/useCommerceTheme";
import { useNotifications } from "../hooks/useLocalDeals";
import { useAuth } from "./AuthContext";
import { useNotificationPreferences } from "./NotificationPreferencesContext";
import {
  buildGroupBuyReminderDates,
  type GroupBuyAlertState,
} from "../services/notifications";
import {
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/notificationPreferences";
import type { GroupBuy } from "../types";

type GroupBuyReminderPickerContextValue = {
  getReminderDays: (groupBuyId: string) => readonly NotificationReminderDay[];
  getReminderState: (groupBuyId: string) => GroupBuyAlertState;
  isReminderEnabled: (groupBuyId: string) => boolean;
  openReminderPicker: (item: GroupBuy) => void;
};

const GroupBuyReminderPickerContext =
  createContext<GroupBuyReminderPickerContextValue | null>(null);

export function getAvailableReminderDays(
  endDate: string | null,
  now = Date.now(),
): NotificationReminderDay[] {
  if (!endDate) return [];
  return NOTIFICATION_REMINDER_DAYS.filter(
    (day) => buildGroupBuyReminderDates(endDate, [day], now).length > 0,
  );
}

export function getInitialReminderDays(
  endDate: string | null,
  currentDays: readonly NotificationReminderDay[],
  now = Date.now(),
) {
  const available = new Set(getAvailableReminderDays(endDate, now));
  return NOTIFICATION_REMINDER_DAYS.filter(
    (day) => available.has(day) && currentDays.includes(day),
  );
}

type GroupBuyReminderPickerProviderProps = PropsWithChildren<{
  onAuthenticationRequired?: () => void;
}>;

export function GroupBuyReminderPickerProvider({
  children,
  onAuthenticationRequired,
}: GroupBuyReminderPickerProviderProps) {
  const { colors } = useCommerceTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferences } = useNotificationPreferences();
  const {
    getNotificationReminderDays,
    getNotificationState,
    isNotifying,
    setNotificationReminders,
  } = useNotifications();
  const [activeItem, setActiveItem] = useState<GroupBuy | null>(null);
  const [selectedDays, setSelectedDays] = useState<NotificationReminderDay[]>(
    [],
  );
  const s = useMemo(() => makeStyles(colors), [colors]);

  const availableDays = useMemo(
    () => getAvailableReminderDays(activeItem?.endDate ?? null),
    [activeItem?.endDate],
  );
  const availableDaySet = useMemo(
    () => new Set<NotificationReminderDay>(availableDays),
    [availableDays],
  );
  const reminderEnabled = activeItem ? isNotifying(activeItem.id) : false;

  const close = useCallback(() => {
    setActiveItem(null);
    setSelectedDays([]);
  }, []);

  const openReminderPicker = useCallback(
    (item: GroupBuy) => {
      if (!user) {
        onAuthenticationRequired?.();
        return;
      }
      setSelectedDays(
        getInitialReminderDays(
          item.endDate,
          getNotificationReminderDays(item.id),
        ),
      );
      setActiveItem(item);
    },
    [getNotificationReminderDays, onAuthenticationRequired, user],
  );

  const toggleDay = useCallback(
    (day: NotificationReminderDay) => {
      if (!availableDaySet.has(day)) return;
      setSelectedDays((current) =>
        current.includes(day)
          ? current.filter((value) => value !== day)
          : NOTIFICATION_REMINDER_DAYS.filter(
              (value) => value === day || current.includes(value),
            ),
      );
    },
    [availableDaySet],
  );

  const persist = useCallback(
    (reminderDays: readonly NotificationReminderDay[]) => {
      if (!activeItem) return;
      const item = activeItem;
      close();
      void setNotificationReminders(item, reminderDays)
        .then((state) => {
          if (state.status !== "failed") return;
          Alert.alert(
            "알림을 저장하지 못했어요",
            "잠시 후 공구 카드의 알림 버튼에서 다시 시도해 주세요.",
          );
        })
        .catch(() => {
          Alert.alert(
            "알림을 저장하지 못했어요",
            "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
          );
        });
    },
    [activeItem, close, setNotificationReminders],
  );

  const contextValue = useMemo<GroupBuyReminderPickerContextValue>(
    () => ({
      getReminderDays: getNotificationReminderDays,
      getReminderState: getNotificationState,
      isReminderEnabled: isNotifying,
      openReminderPicker,
    }),
    [
      getNotificationReminderDays,
      getNotificationState,
      isNotifying,
      openReminderPicker,
    ],
  );

  const hasInvalidEndDate = Boolean(
    activeItem?.endDate && Number.isNaN(new Date(activeItem.endDate).getTime()),
  );
  const unavailableCopy = !activeItem?.endDate
    ? "마감일이 없어 알림을 설정할 수 없어요."
    : hasInvalidEndDate
      ? "마감일 정보가 올바르지 않아 알림을 설정할 수 없어요."
      : availableDays.length === 0
        ? "선택 가능한 알림 시점이 모두 지났어요."
        : null;
  const notificationsPaused =
    !preferences.pushEnabled || !preferences.deadlineRemindersEnabled;

  return (
    <GroupBuyReminderPickerContext.Provider value={contextValue}>
      {children}
      <Modal
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={activeItem !== null}
      >
        <Pressable accessible={false} onPress={close} style={s.backdrop}>
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <View style={s.header}>
              <View style={s.headerCopy}>
                <SText numberOfLines={1} style={s.title} variant="subtitle">
                  마감 알림
                </SText>
                <SText
                  numberOfLines={1}
                  style={s.productName}
                  variant="caption"
                >
                  {activeItem?.productName ?? "공동구매 상품"}
                </SText>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={close}
                style={({ pressed }) => [s.closeButton, pressed && s.pressed]}
              >
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>

            {unavailableCopy ? (
              <View style={s.statusRow}>
                <Ionicons
                  color={colors.warning}
                  name="alert-circle-outline"
                  size={18}
                />
                <SText style={s.statusText} variant="caption">
                  {unavailableCopy}
                </SText>
              </View>
            ) : (
              <View style={s.dayRow}>
                {[...NOTIFICATION_REMINDER_DAYS].reverse().map((day) => {
                  const available = availableDaySet.has(day);
                  const selected = selectedDays.includes(day);
                  return (
                    <Pressable
                      accessibilityLabel={`D-${day} 마감 알림`}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: selected,
                        disabled: !available,
                      }}
                      disabled={!available}
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={({ pressed }) => [
                        s.dayButton,
                        selected && s.dayButtonSelected,
                        !available && s.dayButtonDisabled,
                        pressed && s.pressed,
                      ]}
                      testID={`group-buy-reminder-day-${day}`}
                    >
                      <SText
                        style={[
                          s.dayText,
                          selected && s.dayTextSelected,
                          !available && s.dayTextDisabled,
                        ]}
                        variant="label"
                      >
                        D-{day}
                      </SText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {notificationsPaused && !unavailableCopy ? (
              <SText style={s.pausedText} variant="caption">
                푸시 또는 마감 임박 알림이 꺼져 있어 선택만 저장돼요.
              </SText>
            ) : null}

            <View style={s.actions}>
              {reminderEnabled ? (
                <Pressable
                  accessibilityLabel="마감 알림 끄기"
                  accessibilityRole="button"
                  onPress={() => persist([])}
                  style={({ pressed }) => [
                    s.secondaryButton,
                    pressed && s.pressed,
                  ]}
                  testID="group-buy-reminder-disable"
                >
                  <SText style={s.secondaryButtonText} variant="label">
                    알림 끄기
                  </SText>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel="마감 알림 저장"
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedDays.length === 0 }}
                disabled={selectedDays.length === 0}
                onPress={() => persist(selectedDays)}
                style={({ pressed }) => [
                  s.primaryButton,
                  reminderEnabled && s.primaryButtonFlexible,
                  selectedDays.length === 0 && s.primaryButtonDisabled,
                  pressed && s.pressed,
                ]}
                testID="group-buy-reminder-save"
              >
                <SText style={s.primaryButtonText} variant="label">
                  저장
                </SText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </GroupBuyReminderPickerContext.Provider>
  );
}

export function useGroupBuyReminderPicker() {
  const value = useContext(GroupBuyReminderPickerContext);
  if (!value) {
    throw new Error(
      "useGroupBuyReminderPicker must be used within GroupBuyReminderPickerProvider",
    );
  }
  return value;
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: commerceRadius.lg,
      borderTopRightRadius: commerceRadius.lg,
      paddingHorizontal: commerceSpacing.lg,
      paddingTop: commerceSpacing.lg,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: 48,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: colors.text, letterSpacing: 0 },
    productName: {
      color: colors.muted,
      letterSpacing: 0,
      marginTop: commerceSpacing.xs,
    },
    closeButton: {
      alignItems: "center",
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    dayRow: {
      flexDirection: "row",
      gap: commerceSpacing.sm,
      marginTop: commerceSpacing.xl,
    },
    dayButton: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      flex: 1,
      height: 48,
      justifyContent: "center",
    },
    dayButtonSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    dayButtonDisabled: { opacity: 0.42 },
    dayText: { color: colors.text, letterSpacing: 0 },
    dayTextSelected: { color: colors.accent },
    dayTextDisabled: { color: colors.weak },
    statusRow: {
      alignItems: "center",
      backgroundColor: colors.warningSoft,
      borderRadius: commerceRadius.sm,
      flexDirection: "row",
      gap: commerceSpacing.sm,
      marginTop: commerceSpacing.xl,
      minHeight: 48,
      paddingHorizontal: commerceSpacing.md,
    },
    statusText: { color: colors.warning, flex: 1, letterSpacing: 0 },
    pausedText: {
      color: colors.muted,
      letterSpacing: 0,
      marginTop: commerceSpacing.md,
    },
    actions: {
      flexDirection: "row",
      gap: commerceSpacing.sm,
      marginTop: commerceSpacing.xl,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.sm,
      height: 50,
      justifyContent: "center",
      width: "100%",
    },
    primaryButtonFlexible: { flex: 1, width: "auto" },
    primaryButtonDisabled: { backgroundColor: colors.disabled },
    primaryButtonText: { color: colors.inverse, letterSpacing: 0 },
    secondaryButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      flex: 1,
      height: 50,
      justifyContent: "center",
    },
    secondaryButtonText: { color: colors.text, letterSpacing: 0 },
    pressed: { opacity: 0.72 },
  });
}
