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
import { InstagramProfileAvatar } from "./InstagramProfileAvatar";
import { SText, type STextVariant } from "./SText";

export type InstagramIdentitySize = "compact" | "body" | "title";
export type InstagramIdentityTone = "default" | "inverse";

export interface InstagramIdentityProps {
  username: string | null | undefined;
  profileImageUrl?: string | null;
  size?: InstagramIdentitySize;
  tone?: InstagramIdentityTone;
  showAvatar?: boolean;
  allowWrapping?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  avatarTestID?: string;
  avatarImageTestID?: string;
}

const sizeConfig: Record<
  InstagramIdentitySize,
  { avatarSize: number; textVariant: STextVariant }
> = {
  compact: { avatarSize: 16, textVariant: "caption" },
  body: { avatarSize: 20, textVariant: "body" },
  title: { avatarSize: 26, textVariant: "cardTitle" },
};

export const InstagramIdentity = memo(function InstagramIdentity({
  username,
  profileImageUrl,
  size = "compact",
  tone = "default",
  showAvatar = true,
  allowWrapping = false,
  numberOfLines = 1,
  style,
  textStyle,
  testID,
  avatarTestID,
  avatarImageTestID,
}: InstagramIdentityProps) {
  const { colors } = useCommerceTheme();
  const handle = formatInstagramHandle(username);

  if (!handle) return null;

  const config = sizeConfig[size];
  const inverse = tone === "inverse";
  const textColor = inverse
    ? colors.inverse
    : size === "title"
      ? colors.text
      : colors.muted;

  return (
    <View pointerEvents="none" style={[styles.row, style]}>
      {showAvatar ? (
        <InstagramProfileAvatar
          imageTestID={avatarImageTestID}
          profileImageUrl={profileImageUrl}
          size={config.avatarSize}
          testID={avatarTestID}
          tone={tone}
          username={username}
        />
      ) : null}
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
    gap: 6,
    minWidth: 0,
  },
  text: {
    flexShrink: 1,
    letterSpacing: 0,
    minWidth: 0,
  },
});
