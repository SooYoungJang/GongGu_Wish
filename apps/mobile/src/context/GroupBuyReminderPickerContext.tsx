import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@expo/ui/datetimepicker";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SText } from "../components/ui/SText";
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from "../design/commerce";
import { useCommerceTheme } from "../design/useCommerceTheme";
import { useNotifications } from "../hooks/useLocalDeals";
import type { GroupBuyReminderUpdate } from "../api";
import { useAuth } from "./AuthContext";
import {
  getInitialOpeningReminderDays,
  getInitialReminderDays,
  getOpeningReminderDayOptions,
  getReminderDayOptions,
  getReminderPickerMode,
} from "./groupBuyReminderPicker";
import { useNotificationPreferences } from "./NotificationPreferencesContext";
import type { GroupBuyAlertState } from "../services/notifications";
import {
  NOTIFICATION_REMINDER_DAYS,
  type NotificationReminderDay,
} from "../services/notificationPreferences";
import {
  DEFAULT_OPENING_REMINDER_TIME_MINUTES,
  OPENING_REMINDER_DAYS,
  type OpeningReminderDay,
} from "../services/reminderDates";
import type { GroupBuy } from "../types";

type GroupBuyReminderPickerContextValue = {
  getReminderDays: (groupBuyId: string) => readonly NotificationReminderDay[];
  getReminderState: (groupBuyId: string) => GroupBuyAlertState;
  isReminderEnabled: (groupBuyId: string) => boolean;
  openReminderPicker: (item: GroupBuy) => void;
};

const GroupBuyReminderPickerContext =
  createContext<GroupBuyReminderPickerContextValue | null>(null);

type GroupBuyReminderPickerProviderProps = PropsWithChildren<{
  onAuthenticationRequired?: () => void;
}>;

const REMINDER_BACKDROP_OPEN_MS = 100;
const REMINDER_SHEET_OPEN_MS = 160;
const REMINDER_CLOSE_MS = 120;
const REMINDER_DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatReminderDate(value: Date) {
  const parts = REMINDER_DATE_FORMAT.formatToParts(value);
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;
  const weekday = parts.find(({ type }) => type === "weekday")?.value;
  return [`${month ?? ""}/${day ?? ""}`, weekday].filter(Boolean).join(" ");
}

function formatReminderDay(day: OpeningReminderDay) {
  return day === 0 ? "D-day" : `D-${day}`;
}

function reminderTimeToDate(reminderTimeMinutes: number) {
  return new Date(
    2026,
    0,
    1,
    Math.floor(reminderTimeMinutes / 60),
    reminderTimeMinutes % 60,
  );
}

function formatReminderTime(reminderTimeMinutes: number) {
  const hour = String(Math.floor(reminderTimeMinutes / 60)).padStart(2, "0");
  const minute = String(reminderTimeMinutes % 60).padStart(2, "0");
  return `${hour}:${minute} KST`;
}

export function GroupBuyReminderPickerProvider({
  children,
  onAuthenticationRequired,
}: GroupBuyReminderPickerProviderProps) {
  const { colors } = useCommerceTheme();
  const insets = useSafeAreaInsets();
  const { setAuthContinuation, user } = useAuth();
  const { preferences } = useNotificationPreferences();
  const {
    getNotificationReminderDays,
    getNotificationReminderPreference,
    getNotificationState,
    isNotifying,
    setNotificationReminders,
  } = useNotifications();
  const [activeItem, setActiveItem] = useState<GroupBuy | null>(null);
  const [selectedDays, setSelectedDays] = useState<OpeningReminderDay[]>([]);
  const [reminderTimeMinutes, setReminderTimeMinutes] = useState(
    DEFAULT_OPENING_REMINDER_TIME_MINUTES,
  );
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const closingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const backdropProgress = useSharedValue(0);
  const sheetProgress = useSharedValue(0);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const reminderMode = getReminderPickerMode(activeItem?.startDate ?? null);
  const reminderOptions = useMemo(
    () =>
      reminderMode === "opening"
        ? getOpeningReminderDayOptions(
            activeItem?.startDate ?? null,
            reminderTimeMinutes,
          )
        : getReminderDayOptions(activeItem?.endDate ?? null),
    [
      activeItem?.endDate,
      activeItem?.startDate,
      reminderMode,
      reminderTimeMinutes,
    ],
  );
  const availableDays = useMemo(
    () =>
      reminderOptions
        .filter(({ available }) => available)
        .map(({ reminderDay }) => reminderDay),
    [reminderOptions],
  );
  const availableDaySet = useMemo(
    () => new Set<OpeningReminderDay>(availableDays),
    [availableDays],
  );
  const reminderEnabled = activeItem ? isNotifying(activeItem.id) : false;

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 24 * (1 - sheetProgress.value) }],
  }));

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setActiveItem(null);
    setSelectedDays([]);
    setReminderTimeMinutes(DEFAULT_OPENING_REMINDER_TIME_MINUTES);
    setShowAndroidTimePicker(false);
  }, []);

  const close = useCallback(() => {
    if (!activeItem || closingRef.current) return;
    closingRef.current = true;
    const duration = reduceMotion ? 0 : REMINDER_CLOSE_MS;
    backdropProgress.value = withTiming(0, { duration });
    sheetProgress.value = withTiming(
      0,
      { duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [activeItem, backdropProgress, finishClose, reduceMotion, sheetProgress]);

  useEffect(() => {
    if (!activeItem) return;
    closingRef.current = false;
    backdropProgress.value = withTiming(1, {
      duration: reduceMotion ? 0 : REMINDER_BACKDROP_OPEN_MS,
    });
    sheetProgress.value = withTiming(1, {
      duration: reduceMotion ? 0 : REMINDER_SHEET_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeItem, backdropProgress, reduceMotion, sheetProgress]);

  const openReminderPickerNow = useCallback(
    (item: GroupBuy) => {
      const mode = getReminderPickerMode(item.startDate);
      const existingPreference = getNotificationReminderPreference(item.id);
      if (mode === "opening") {
        const timeMinutes =
          existingPreference?.type === "opening"
            ? existingPreference.reminderTimeMinutes
            : DEFAULT_OPENING_REMINDER_TIME_MINUTES;
        setReminderTimeMinutes(timeMinutes);
        setSelectedDays(
          getInitialOpeningReminderDays(
            item.startDate,
            existingPreference?.type === "opening"
              ? existingPreference.reminderDays
              : [],
            timeMinutes,
          ),
        );
      } else {
        setReminderTimeMinutes(DEFAULT_OPENING_REMINDER_TIME_MINUTES);
        setSelectedDays(
          getInitialReminderDays(
            item.endDate,
            existingPreference?.type === "deadline"
              ? existingPreference.reminderDays
              : getNotificationReminderDays(item.id),
          ),
        );
      }
      backdropProgress.value = 0;
      sheetProgress.value = 0;
      setActiveItem(item);
    },
    [
      backdropProgress,
      getNotificationReminderDays,
      getNotificationReminderPreference,
      sheetProgress,
    ],
  );

  const openReminderPicker = useCallback(
    (item: GroupBuy) => openReminderPickerNow(item),
    [openReminderPickerNow],
  );

  const toggleDay = useCallback(
    (day: OpeningReminderDay) => {
      if (!availableDaySet.has(day)) return;
      setSelectedDays((current) =>
        current.includes(day)
          ? current.filter((value) => value !== day)
          : (reminderMode === "opening"
              ? OPENING_REMINDER_DAYS
              : NOTIFICATION_REMINDER_DAYS
            ).filter((value) => value === day || current.includes(value)),
      );
    },
    [availableDaySet, reminderMode],
  );

  const updateReminderTime = useCallback(
    (date: Date) => {
      const nextMinutes = date.getHours() * 60 + date.getMinutes();
      setReminderTimeMinutes(nextMinutes);
      const nextAvailable = new Set(
        getOpeningReminderDayOptions(activeItem?.startDate ?? null, nextMinutes)
          .filter(({ available }) => available)
          .map(({ reminderDay }) => reminderDay),
      );
      setSelectedDays((current) =>
        current.filter((day) => nextAvailable.has(day)),
      );
    },
    [activeItem?.startDate],
  );

  const persistReminder = useCallback(
    async (item: GroupBuy, reminderPreference: GroupBuyReminderUpdate) => {
      try {
        const state = await setNotificationReminders(item, reminderPreference);
        if (state.status !== "failed") return;
        Alert.alert(
          "알림을 저장하지 못했어요",
          "잠시 후 공구 카드의 알림 버튼에서 다시 시도해 주세요.",
        );
      } catch {
        Alert.alert(
          "알림을 저장하지 못했어요",
          "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        );
      }
    },
    [setNotificationReminders],
  );
  const latestPersistReminderRef = useRef(persistReminder);
  latestPersistReminderRef.current = persistReminder;

  const persist = useCallback(
    (reminderDays: readonly OpeningReminderDay[]) => {
      if (!activeItem) return;
      const item = activeItem;
      const reminderPreference: GroupBuyReminderUpdate =
        reminderMode === "opening"
          ? {
              type: "opening",
              reminderDays,
              reminderTimeMinutes,
            }
          : {
              type: "deadline",
              reminderDays: reminderDays.filter(
                (day): day is NotificationReminderDay => day !== 0,
              ),
              reminderTimeMinutes: null,
            };
      close();
      if (!user) {
        setAuthContinuation(() =>
          latestPersistReminderRef.current(item, reminderPreference),
        );
        onAuthenticationRequired?.();
        return;
      }
      void persistReminder(item, reminderPreference);
    },
    [
      activeItem,
      close,
      onAuthenticationRequired,
      reminderMode,
      reminderTimeMinutes,
      persistReminder,
      setAuthContinuation,
      user,
    ],
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
  const hasInvalidStartDate = Boolean(
    activeItem?.startDate &&
    Number.isNaN(new Date(activeItem.startDate).getTime()),
  );
  const unavailableCopy =
    reminderMode === "opening"
      ? !activeItem?.startDate
        ? "오픈일이 없어 알림을 설정할 수 없어요."
        : hasInvalidStartDate
          ? "오픈일 정보가 올바르지 않아 알림을 설정할 수 없어요."
          : availableDays.length === 0
            ? "선택 가능한 알림 시점이 모두 지났어요."
            : null
      : !activeItem?.endDate
        ? "마감일이 없어 알림을 설정할 수 없어요."
        : hasInvalidEndDate
          ? "마감일 정보가 올바르지 않아 알림을 설정할 수 없어요."
          : availableDays.length === 0
            ? "선택 가능한 알림 시점이 모두 지났어요."
            : null;
  const activePreference = activeItem
    ? getNotificationReminderPreference(activeItem.id)
    : null;
  const hasPendingOpeningReminder =
    reminderMode === "deadline" && activePreference?.type === "opening";
  const notificationsPaused = !preferences.pushEnabled;

  return (
    <GroupBuyReminderPickerContext.Provider value={contextValue}>
      {children}
      <Modal
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={activeItem !== null}
      >
        <Pressable accessible={false} onPress={close} style={s.dismissLayer}>
          <Animated.View
            pointerEvents="none"
            style={[s.backdrop, backdropAnimatedStyle]}
          />
          <AnimatedPressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[
              s.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
              sheetAnimatedStyle,
            ]}
          >
            <View style={s.header}>
              <View style={s.headerCopy}>
                <SText numberOfLines={1} style={s.title} variant="subtitle">
                  {reminderMode === "opening"
                    ? "공구 오픈 알림"
                    : "공구 마감 알림"}
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
                {[...reminderOptions].reverse().map((option) => {
                  const day = option.reminderDay;
                  const available = option.available;
                  const selected = selectedDays.includes(day);
                  const dateLabel = formatReminderDate(option.triggerDate);
                  return (
                    <Pressable
                      accessibilityLabel={`${formatReminderDay(day)}, ${dateLabel} ${reminderMode === "opening" ? "오픈" : "마감"} 알림`}
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
                        {formatReminderDay(day)}
                      </SText>
                      <SText
                        style={[
                          s.dayDateText,
                          selected && s.dayTextSelected,
                          !available && s.dayTextDisabled,
                        ]}
                        variant="caption"
                      >
                        {dateLabel}
                      </SText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {reminderMode === "opening" && !hasInvalidStartDate ? (
              <View style={s.timeSection}>
                <View style={s.timeCopy}>
                  <SText style={s.timeLabel} variant="label">
                    알림 시간
                  </SText>
                  <SText style={s.timeHint} variant="caption">
                    선택한 모든 날에 한국 시간 기준으로 알려드려요.
                  </SText>
                </View>
                {Platform.OS === "android" ? (
                  <Pressable
                    accessibilityLabel={`알림 시간 ${formatReminderTime(reminderTimeMinutes)}`}
                    accessibilityRole="button"
                    onPress={() => setShowAndroidTimePicker(true)}
                    style={({ pressed }) => [
                      s.timeButton,
                      pressed && s.pressed,
                    ]}
                    testID="group-buy-opening-reminder-time"
                  >
                    <Ionicons
                      color={colors.accent}
                      name="time-outline"
                      size={18}
                    />
                    <SText style={s.timeButtonText} variant="label">
                      {formatReminderTime(reminderTimeMinutes)}
                    </SText>
                  </Pressable>
                ) : (
                  <DateTimePicker
                    accentColor={colors.accent}
                    display="compact"
                    locale="ko_KR"
                    mode="time"
                    onValueChange={(_event, date) => updateReminderTime(date)}
                    style={s.iosTimePicker}
                    testID="group-buy-opening-reminder-time"
                    value={reminderTimeToDate(reminderTimeMinutes)}
                  />
                )}
                {Platform.OS === "android" && showAndroidTimePicker ? (
                  <DateTimePicker
                    display="default"
                    is24Hour
                    mode="time"
                    negativeButton={{ label: "취소" }}
                    onDismiss={() => setShowAndroidTimePicker(false)}
                    onValueChange={(_event, date) => {
                      setShowAndroidTimePicker(false);
                      updateReminderTime(date);
                    }}
                    positiveButton={{ label: "확인" }}
                    presentation="dialog"
                    value={reminderTimeToDate(reminderTimeMinutes)}
                  />
                ) : null}
              </View>
            ) : null}

            {hasPendingOpeningReminder ? (
              <View style={s.pendingOpeningRow}>
                <Ionicons
                  color={colors.accent}
                  name="information-circle-outline"
                  size={18}
                />
                <SText style={s.pendingOpeningText} variant="caption">
                  아직 남은 오픈 알림이 있어요. 저장하면 마감 알림으로 교체돼요.
                </SText>
              </View>
            ) : null}

            {notificationsPaused && !unavailableCopy ? (
              <SText style={s.pausedText} variant="caption">
                저장하면 푸시 알림도 함께 켜져요.
              </SText>
            ) : null}

            <View style={s.actions}>
              {reminderEnabled ? (
                <Pressable
                  accessibilityLabel={`${activePreference?.type === "opening" ? "오픈" : "마감"} 알림 끄기`}
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
                accessibilityLabel={`${reminderMode === "opening" ? "오픈" : "마감"} 알림 저장`}
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
          </AnimatedPressable>
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
    dismissLayer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      backgroundColor: colors.overlay,
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
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
      flexWrap: "wrap",
      gap: commerceSpacing.sm,
      marginTop: commerceSpacing.xl,
    },
    dayButton: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      flexBasis: "22%",
      flexGrow: 1,
      height: 64,
      justifyContent: "center",
      maxWidth: "24%",
    },
    dayButtonSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    dayButtonDisabled: { opacity: 0.42 },
    dayText: { color: colors.text, letterSpacing: 0 },
    dayDateText: {
      color: colors.muted,
      letterSpacing: 0,
      marginTop: commerceSpacing.xs,
    },
    dayTextSelected: { color: colors.accent },
    dayTextDisabled: { color: colors.weak },
    timeSection: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: commerceSpacing.md,
      marginTop: commerceSpacing.lg,
      minHeight: 64,
      paddingTop: commerceSpacing.md,
    },
    timeCopy: { flex: 1, minWidth: 0 },
    timeLabel: { color: colors.text, letterSpacing: 0 },
    timeHint: {
      color: colors.muted,
      letterSpacing: 0,
      marginTop: commerceSpacing.xs,
    },
    timeButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: commerceSpacing.xs,
      height: 42,
      justifyContent: "center",
      minWidth: 116,
      paddingHorizontal: commerceSpacing.sm,
    },
    timeButtonText: { color: colors.text, letterSpacing: 0 },
    iosTimePicker: { minHeight: 42, minWidth: 104 },
    pendingOpeningRow: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.sm,
      flexDirection: "row",
      gap: commerceSpacing.sm,
      marginTop: commerceSpacing.md,
      minHeight: 48,
      paddingHorizontal: commerceSpacing.md,
    },
    pendingOpeningText: {
      color: colors.text,
      flex: 1,
      letterSpacing: 0,
    },
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
