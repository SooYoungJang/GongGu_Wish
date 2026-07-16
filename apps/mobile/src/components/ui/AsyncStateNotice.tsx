import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { commerceRadius, type CommerceColorPalette } from "../../design/commerce";
import { spacing } from "../../design/tokens";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { SText } from "./SText";

export type AsyncStateVariant = "empty" | "error" | "stale";

export type AsyncStateNoticeProps = {
  actionLabel?: string;
  appearance?: "default" | "inverse";
  compact?: boolean;
  isRetrying?: boolean;
  message?: string;
  onRetry?: () => void | Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  variant: AsyncStateVariant;
};

export function AsyncStateNotice({
  actionLabel = "다시 불러오기",
  appearance = "default",
  compact = false,
  isRetrying = false,
  message,
  onRetry,
  style,
  testID = "async-state-notice",
  title,
  variant,
}: AsyncStateNoticeProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const inverse = appearance === "inverse";

  return (
    <View
      accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
      accessibilityRole={variant === "error" ? "alert" : undefined}
      importantForAccessibility="yes"
      style={[
        s.container,
        s[variant],
        compact && s.compact,
        inverse && s.inverse,
        style,
      ]}
      testID={testID}
    >
      <SText
        accessibilityRole="header"
        style={[s.title, inverse && s.inverseTitle]}
        variant="subtitle"
      >
        {title}
      </SText>
      {message ? (
        <SText
          style={[s.message, inverse && s.inverseMessage]}
          variant="caption"
        >
          {message}
        </SText>
      ) : null}
      {onRetry ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
          disabled={isRetrying}
          onPress={onRetry}
          style={({ pressed }) => [
            s.action,
            pressed && !isRetrying && s.pressed,
            isRetrying && s.disabled,
          ]}
        >
          {isRetrying ? (
            <ActivityIndicator color={colors.inverse} size="small" />
          ) : null}
          <SText style={s.actionText} variant="label">
            {isRetrying ? "불러오는 중" : actionLabel}
          </SText>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    action: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.full,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      marginTop: spacing.md,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    actionText: {
      color: colors.inverse,
      fontWeight: "900",
    },
    compact: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    container: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      marginVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    disabled: {
      opacity: 0.64,
    },
    empty: {
      backgroundColor: colors.panelBg,
    },
    error: {
      backgroundColor: colors.errorSoft,
      borderColor: colors.error,
    },
    inverse: {
      backgroundColor: "rgba(0, 0, 0, 0.74)",
      borderColor: "rgba(255, 255, 255, 0.22)",
    },
    inverseMessage: {
      color: "rgba(255, 255, 255, 0.78)",
    },
    inverseTitle: {
      color: "#FFFFFF",
    },
    message: {
      color: colors.muted,
      lineHeight: 20,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
    stale: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    title: {
      color: colors.text,
      fontWeight: "900",
      textAlign: "center",
    },
  });
}
