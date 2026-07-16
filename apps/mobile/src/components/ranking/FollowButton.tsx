import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type { GroupBuyAlertState } from "../../services/notifications";

export interface GroupBuyAlertButtonProps {
  isEnabled: boolean;
  groupBuyName: string;
  notificationState?: GroupBuyAlertState;
  onPress?: () => void;
  onRetry?: () => void;
}

export function GroupBuyAlertButton({
  isEnabled,
  groupBuyName,
  notificationState = { status: "idle" },
  onPress,
  onRetry,
}: GroupBuyAlertButtonProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isPending = notificationState.status === "pending";
  const isRetry = notificationState.status === "failed";
  const label = isPending
    ? `${groupBuyName} 알림 처리 중`
    : isRetry
      ? `${groupBuyName} 알림 재시도`
      : notificationState.status === "unsupported" ||
          notificationState.status === "unavailable"
        ? `${groupBuyName} 알림 설정 불가`
        : `${groupBuyName} ${isEnabled ? "알림 해제" : "알림"}`;
  const hint = isPending
    ? "공구 알림 처리 중입니다"
    : isRetry
      ? "공구 알림을 다시 설정합니다"
      : notificationState.status === "unsupported" ||
          notificationState.status === "unavailable"
        ? "현재 환경에서 공구 알림을 설정할 수 없습니다"
        : "공구 알림 설정을 변경합니다";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
      accessibilityState={{ busy: isPending, disabled: isPending }}
      disabled={isPending}
      onPress={isRetry ? (onRetry ?? onPress) : onPress}
      style={({ pressed }) => [
        s.button,
        isEnabled ? s.followingButton : s.followButton,
        pressed && s.pressed,
      ]}
    >
      <Ionicons
        color={colors.accent}
        name={isEnabled ? "notifications" : "notifications-outline"}
        size={20}
      />
    </Pressable>
  );
}

/** @deprecated Use GroupBuyAlertButton for 공구 알림 semantics. */
export interface FollowButtonProps {
  isFollowing: boolean;
  sellerName: string;
  onFollow?: () => void;
}

/** @deprecated Compatibility alias for older ranking consumers. */
export function FollowButton({
  isFollowing,
  sellerName,
  onFollow,
}: FollowButtonProps) {
  return (
    <GroupBuyAlertButton
      groupBuyName={sellerName}
      isEnabled={isFollowing}
      onPress={onFollow}
    />
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    button: {
      alignItems: "center",
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    followButton: {
      backgroundColor: "transparent",
      borderColor: colors.accent,
    },
    followingButton: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentSoft,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
