import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { BackButton } from "./BackButton";
import { spacing } from "../design/tokens";
import { useCommerceTheme } from "../design/useCommerceTheme";

export interface CenteredBackHeaderProps {
  backButtonAccessibilityLabel?: string;
  backButtonColor?: string;
  backButtonTestID?: string;
  onBack?: () => void;
  right?: ReactNode;
  showBackButton?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
}

/**
 * Shared navigation row with equal side slots, so the title stays centered
 * regardless of whether either side contains an action.
 */
export function CenteredBackHeader({
  backButtonAccessibilityLabel = "뒤로가기",
  backButtonColor,
  backButtonTestID,
  onBack,
  right,
  showBackButton = true,
  style,
  testID = "centered-back-header",
  title,
  titleStyle,
}: CenteredBackHeaderProps) {
  const { colors } = useCommerceTheme();

  return (
    <View style={[styles.header, style]} testID={testID}>
      <View style={styles.side} testID={`${testID}-leading`}>
        {showBackButton ? (
          <BackButton
            accessibilityLabel={backButtonAccessibilityLabel}
            color={backButtonColor}
            onPress={onBack}
            testID={backButtonTestID}
          />
        ) : null}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.title, { color: colors.text }, titleStyle]}
        testID={`${testID}-title`}
      >
        {title}
      </Text>
      <View style={styles.side} testID={`${testID}-trailing`}>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    width: "100%",
  },
  side: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 22,
    textAlign: "center",
  },
});
