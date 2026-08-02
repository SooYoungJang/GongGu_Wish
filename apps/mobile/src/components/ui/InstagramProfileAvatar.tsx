import { Image } from "expo-image";
import { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import { SText } from "./SText";

export interface InstagramProfileAvatarProps {
  username: string | null | undefined;
  profileImageUrl?: string | null;
  size?: number;
  tone?: "default" | "inverse";
  style?: StyleProp<ViewStyle>;
  testID?: string;
  imageTestID?: string;
  fallbackTestID?: string;
}

export const InstagramProfileAvatar = memo(function InstagramProfileAvatar({
  username,
  profileImageUrl,
  size = 20,
  tone = "default",
  style,
  testID,
  imageTestID,
  fallbackTestID,
}: InstagramProfileAvatarProps) {
  const { colors } = useCommerceTheme();
  const handle = formatInstagramHandle(username);
  const imageUrl = profileImageUrl?.trim() || null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageSource = useMemo(
    () => (imageUrl ? { uri: imageUrl } : null),
    [imageUrl],
  );
  const handleImageError = useCallback(() => {
    if (imageUrl) setFailedImageUrl(imageUrl);
  }, [imageUrl]);
  const initial =
    Array.from(handle?.replace(/^@/, "") ?? "?")[0]?.toUpperCase() ?? "?";
  const inverse = tone === "inverse";

  return (
    <View
      accessibilityLabel={
        handle ? `${handle} 프로필 이미지` : "인스타그램 프로필 이미지"
      }
      accessibilityRole="image"
      accessible
      style={[
        styles.avatar,
        {
          backgroundColor: inverse ? colors.overlay : colors.accentSoft,
          borderColor: inverse ? colors.inverse : colors.border,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
        style,
      ]}
      testID={testID}
    >
      {imageSource && imageUrl !== failedImageUrl ? (
        <Image
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={handleImageError}
          recyclingKey={imageUrl}
          source={imageSource}
          style={styles.image}
          testID={imageTestID}
          transition={120}
        />
      ) : (
        <SText
          accessible={false}
          style={[
            styles.fallbackText,
            {
              color: inverse ? colors.inverse : colors.accent,
              fontSize: Math.max(9, Math.round(size * 0.44)),
              lineHeight: size,
            },
          ]}
          testID={fallbackTestID}
          variant="caption"
        >
          {initial}
        </SText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  fallbackText: {
    fontWeight: "900",
    textAlign: "center",
  },
  image: {
    height: "100%",
    width: "100%",
  },
});
