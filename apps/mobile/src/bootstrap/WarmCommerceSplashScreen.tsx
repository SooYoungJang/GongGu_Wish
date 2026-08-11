import React from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import warmCommerceSplashSource from "../../assets/warm-commerce-splash-portrait.png";

export const WARM_COMMERCE_SPLASH_BACKGROUND = "#FFF4EA";

type WarmCommerceSplashScreenProps = {
  onReady: () => void;
};

export function WarmCommerceSplashScreen({
  onReady,
}: WarmCommerceSplashScreenProps) {
  return (
    <View
      accessibilityLabel="공구위시 앱을 준비하고 있어요"
      accessibilityRole="image"
      style={styles.surface}
      testID="warm-commerce-splash"
    >
      <Image
        accessible={false}
        contentFit="cover"
        onDisplay={onReady}
        onError={onReady}
        priority="high"
        source={warmCommerceSplashSource}
        style={styles.artwork}
        testID="warm-commerce-splash-artwork"
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  surface: {
    backgroundColor: WARM_COMMERCE_SPLASH_BACKGROUND,
    flex: 1,
    overflow: "hidden",
  },
});
