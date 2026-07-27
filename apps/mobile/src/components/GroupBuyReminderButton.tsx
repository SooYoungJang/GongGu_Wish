import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { commerceRadius, type CommerceColorPalette } from "../design/commerce";
import { useCommerceTheme } from "../design/useCommerceTheme";
import { useGroupBuyReminderPicker } from "../context/GroupBuyReminderPickerContext";
import { getReminderPickerMode } from "../context/groupBuyReminderPicker";
import type { GroupBuy } from "../types";

type GroupBuyReminderButtonProps = {
  item: GroupBuy;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function GroupBuyReminderButton({
  item,
  size = 34,
  style,
}: GroupBuyReminderButtonProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { getReminderState, isReminderEnabled, openReminderPicker } =
    useGroupBuyReminderPicker();
  const enabled = isReminderEnabled(item.id);
  const pending = getReminderState(item.id).status === "pending";
  const reminderLabel =
    getReminderPickerMode(item.startDate) === "opening" ? "오픈" : "마감";

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    openReminderPicker(item);
  };

  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? "공동구매 상품"} ${
        enabled
          ? `${reminderLabel} 알림 설정 변경`
          : `${reminderLabel} 알림 설정`
      }`}
      accessibilityRole="button"
      accessibilityState={{ busy: pending, selected: enabled }}
      disabled={pending}
      hitSlop={6}
      onPress={handlePress}
      style={({ pressed }) => [
        s.button,
        { height: size, width: size },
        enabled && s.buttonEnabled,
        style,
        pressed && s.pressed,
      ]}
      testID={`group-buy-reminder-button-${item.id}`}
    >
      {pending ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Ionicons
          color={enabled ? colors.accent : colors.text}
          name={enabled ? "notifications" : "notifications-outline"}
          size={Math.round(size * 0.56)}
        />
      )}
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    button: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: "center",
    },
    buttonEnabled: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    pressed: { opacity: 0.72 },
  });
}
