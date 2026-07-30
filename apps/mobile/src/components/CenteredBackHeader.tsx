import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { BackButton } from "./BackButton";
import { spacing } from "../design/tokens";
import { useCommerceTheme } from "../design/useCommerceTheme";

export type NavigationHeaderTitleVariant = "default" | "overlay";

export interface NavigationHeaderTitleProps {
  fill?: boolean;
  testID?: string;
  title: string;
  variant?: NavigationHeaderTitleVariant;
}

export function NavigationHeaderTitle({
  fill = false,
  testID,
  title,
  variant = "default",
}: NavigationHeaderTitleProps) {
  const { colors } = useCommerceTheme();

  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      style={[
        styles.title,
        fill && styles.titleFill,
        { color: colors.text },
        variant === "overlay" && styles.titleOverlay,
      ]}
      testID={testID}
    >
      {title}
    </Text>
  );
}

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
  titleVariant?: NavigationHeaderTitleVariant;
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
  titleVariant,
}: CenteredBackHeaderProps) {
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
      <NavigationHeaderTitle
        fill
        testID={`${testID}-title`}
        title={title}
        variant={titleVariant}
      />
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
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 26,
    maxWidth: "100%",
    textAlign: "center",
  },
  titleFill: {
    flex: 1,
  },
  titleOverlay: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.36)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
