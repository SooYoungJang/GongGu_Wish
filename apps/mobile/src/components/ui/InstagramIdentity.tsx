import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import { SText, type STextVariant } from "./SText";

export type InstagramIdentitySize = "compact" | "body" | "title";
export type InstagramIdentityTone = "default" | "inverse";

export interface InstagramIdentityProps {
  username: string | null | undefined;
  size?: InstagramIdentitySize;
  tone?: InstagramIdentityTone;
  allowWrapping?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  iconTestID?: string;
}

const sizeConfig: Record<
  InstagramIdentitySize,
  { iconSize: number; textVariant: STextVariant }
> = {
  compact: { iconSize: 13, textVariant: "caption" },
  body: { iconSize: 15, textVariant: "body" },
  title: { iconSize: 18, textVariant: "cardTitle" },
};

export const InstagramIdentity = memo(function InstagramIdentity({
  username,
  size = "compact",
  tone = "default",
  allowWrapping = false,
  numberOfLines = 1,
  style,
  textStyle,
  testID,
  iconTestID,
}: InstagramIdentityProps) {
  const { colors } = useCommerceTheme();
  const handle = formatInstagramHandle(username);

  if (!handle) return null;

  const config = sizeConfig[size];
  const inverse = tone === "inverse";
  const iconColor = inverse ? colors.inverse : colors.accent;
  const textColor = inverse
    ? colors.inverse
    : size === "title"
      ? colors.text
      : colors.muted;

  return (
    <View pointerEvents="none" style={[styles.row, style]}>
      <Ionicons
        accessible={false}
        color={iconColor}
        name="logo-instagram"
        size={config.iconSize}
        testID={iconTestID}
      />
      <SText
        numberOfLines={allowWrapping ? undefined : numberOfLines}
        style={[styles.text, { color: textColor }, textStyle]}
        testID={testID}
        variant={config.textVariant}
      >
        {handle}
      </SText>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    minWidth: 0,
  },
  text: {
    flexShrink: 1,
    letterSpacing: 0,
    minWidth: 0,
  },
});
