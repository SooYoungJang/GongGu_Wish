import { memo, useCallback } from "react";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import {
  formatInstagramHandle,
  normalizeOptionalInstagramUsername,
} from "@gonggu/shared/utils/instagram";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import type { RootStackParamList } from "../../types";
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
  navigationEnabled?: boolean;
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
  navigationEnabled = true,
  allowWrapping = false,
  numberOfLines = 1,
  style,
  textStyle,
  testID,
  avatarTestID,
  avatarImageTestID,
}: InstagramIdentityProps) {
  const { colors } = useCommerceTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const handle = formatInstagramHandle(username);
  const normalizedUsername = normalizeOptionalInstagramUsername(username);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      if (!navigation || !normalizedUsername) return;

      navigation.navigate("InfluencerGroupBuys", {
        influencerDisplayName: null,
        influencerProfileImageUrl: profileImageUrl ?? null,
        influencerUsername: normalizedUsername,
      });
    },
    [navigation, normalizedUsername, profileImageUrl],
  );

  if (!handle) return null;

  const config = sizeConfig[size];
  const inverse = tone === "inverse";
  const textColor = inverse
    ? colors.inverse
    : size === "title"
      ? colors.text
      : colors.muted;

  const content = (
    <>
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
    </>
  );

  if (navigationEnabled && navigation && normalizedUsername) {
    return (
      <Pressable
        accessible
        accessibilityLabel={`${handle} 인플루언서 공구 보기`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.row,
          style,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.row, style]}>
      {content}
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
  pressed: {
    opacity: 0.68,
  },
});
