import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAudience } from "./AudienceContext";

export function AudienceGate({ children }: { children: React.ReactNode }) {
  const { ageBand, isHydrated, selectAgeBand } = useAudience();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState(false);

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.centered} testID="audience-loading">
        <ActivityIndicator color="#ff5a5f" size="small" />
        <Text style={styles.loadingText}>이용 설정을 확인하고 있어요.</Text>
      </SafeAreaView>
    );
  }

  if (ageBand === null) {
    const select = async (nextAgeBand: "age13" | "age14Plus") => {
      if (isSelecting) return;
      setIsSelecting(true);
      setSelectionError(false);
      try {
        await selectAgeBand(nextAgeBand);
      } catch {
        setSelectionError(true);
      } finally {
        setIsSelecting(false);
      }
    };

    return (
      <SafeAreaView style={styles.ageScreen} testID="age-selection-screen">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.brandMark}
        >
          <Text style={styles.brandHeart}>♥</Text>
        </View>
        <View style={styles.ageCopy}>
          <Text accessibilityRole="header" style={styles.ageTitle}>
            공구위시 이용 전{`\n`}연령을 확인해주세요
          </Text>
          <Text style={styles.ageDescription}>
            맞춤 기능과 광고 제공 여부를 안전하게 설정하기 위해 한 번만
            확인해요.
          </Text>
        </View>
        <View style={styles.ageActions}>
          <Pressable
            accessibilityHint="광고와 로그인 기능을 사용할 수 있도록 설정합니다"
            accessibilityLabel="만 14세 이상입니다"
            accessibilityRole="button"
            disabled={isSelecting}
            onPress={() => void select("age14Plus")}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isSelecting && styles.disabled,
            ]}
            testID="age-14-plus-button"
          >
            <Text style={styles.primaryButtonText}>만 14세 이상입니다</Text>
          </Pressable>
          <Pressable
            accessibilityHint="광고와 로그인 없이 공개 공구를 둘러봅니다"
            accessibilityLabel="만 14세 미만입니다"
            accessibilityRole="button"
            disabled={isSelecting}
            onPress={() => void select("age13")}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
              isSelecting && styles.disabled,
            ]}
            testID="age-under-14-button"
          >
            <Text style={styles.secondaryButtonText}>만 14세 미만입니다</Text>
          </Pressable>
          <Text style={styles.ageFootnote}>
            만 14세 미만은 공개 공구를 둘러볼 수 있지만 광고와 로그인 기능은
            제한됩니다.
          </Text>
          {selectionError ? (
            <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
              연령 설정을 저장하지 못했어요. 다시 선택해주세요.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: "#fffaf8",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 12,
  },
  ageScreen: {
    backgroundColor: "#fff8f3",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  brandMark: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ff665e",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  brandHeart: {
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 25,
  },
  ageCopy: {
    marginTop: "auto",
    paddingBottom: 40,
  },
  ageTitle: {
    color: "#3f2d25",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 39,
  },
  ageDescription: {
    color: "#78645b",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 330,
  },
  ageActions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ff5f57",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#eadbd2",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: "#5c463c",
    fontSize: 16,
    fontWeight: "700",
  },
  ageFootnote: {
    color: "#8a756b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 4,
    textAlign: "center",
  },
  errorText: {
    color: "#b42318",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});
